import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { getRedisClient } from '../lib/redis';
import { connectToDatabase } from '../lib/db';
import User from '../models/User';
import Match from '../models/Match';
import { DynamicSudokuGenerator } from '../lib/generator/dynamic';
import { verifyCell, getCompletionProgress } from '../lib/generator/helpers';
import mongoose from 'mongoose';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_sudoku_secret_key';

interface PlayerState {
  userId: string;
  username: string;
  progress: number;
  isResigned: boolean;
  isFinished: boolean;
  completionTime: number | null;
  mistakes: number;
}

interface RoomState {
  roomCode: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  status: 'lobby' | 'playing' | 'finished';
  players: PlayerState[];
  startBoard: number[][];
  solution: number[][];
  startTime: number | null;
  maxMistakes: number;
}

let ioInstance: Server | null = null;
const activeReconnectionTimers = new Map<string, NodeJS.Timeout>();

export function initSocketIO(io: Server) {
  ioInstance = io;
  // Middleware to authenticate Socket.IO connections
  io.use(async (socket: Socket, next) => {
    try {
      const handshakeCookie = socket.handshake.headers.cookie || '';
      const parsedCookies = cookie.parse(handshakeCookie);
      const token = parsedCookies.token;

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };
      socket.data.userId = decoded.userId;
      socket.data.username = decoded.username;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

    io.on('connection', async (socket: Socket) => {
      const userId = socket.data.userId;
      const username = socket.data.username;
      console.log(`Socket connected: ${username} (${userId})`);
  
      const redis = await getRedisClient();
  
      // Session Kick: check if active socket already registered for user
      const existingSocketId = await redis.get(`user:active-socket:${userId}`);
      if (existingSocketId && existingSocketId !== socket.id) {
        const existingSocket = io.sockets.sockets.get(existingSocketId);
        if (existingSocket) {
          console.log(`Superseding old socket connection: ${existingSocketId} for user ${username}`);
          existingSocket.emit('session_kick', {
            message: 'You have been disconnected because your account logged in on another device.',
          });
          existingSocket.disconnect(true);
        }
      }
  
      // Set new active socket mapping
      await redis.set(`user:active-socket:${userId}`, socket.id);
      await redis.set(`socket:${socket.id}`, userId);
  
      // Cancel any active disconnection timers for this user
      if (activeReconnectionTimers.has(userId)) {
        clearTimeout(activeReconnectionTimers.get(userId));
        activeReconnectionTimers.delete(userId);
        console.log(`Reconnection timer cleared for user ${username}`);
      }

    // Helper: Find room user is currently in (if any)
    const findUserRoom = async (uid: string): Promise<RoomState | null> => {
      const keys = await redis.keys('room:*');
      for (const key of keys) {
        const data = await redis.get(key);
        if (data) {
          const room: RoomState = JSON.parse(data);
          if (room.players.some((p) => p.userId === uid)) {
            return room;
          }
        }
      }
      return null;
    };

    // Reconnection handling: check if user was in an active game
    const existingRoom = await findUserRoom(userId);
    if (existingRoom) {
      socket.join(existingRoom.roomCode);
      io.to(existingRoom.roomCode).emit('player_reconnected', { userId, username });
    }

    // Create Room
    socket.on('create_room', async ({ difficulty, maxMistakes }: { difficulty: 'easy' | 'medium' | 'hard' | 'expert'; maxMistakes?: number }) => {
      try {
        const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        // Generate board
        const generator = new DynamicSudokuGenerator();
        const board = await generator.generate(difficulty);

        const newRoom: RoomState = {
          roomCode,
          difficulty,
          status: 'lobby',
          players: [
            {
              userId,
              username,
              progress: 0,
              isResigned: false,
              isFinished: false,
              completionTime: null,
              mistakes: 0,
            },
          ],
          startBoard: board.startBoard,
          solution: board.solution,
          startTime: null,
          maxMistakes: maxMistakes !== undefined ? maxMistakes : 3,
        };

        await redis.set(`room:${roomCode}`, JSON.stringify(newRoom));
        socket.join(roomCode);
        socket.emit('room_created', newRoom);
      } catch (err) {
        console.error('Create room error:', err);
        socket.emit('error', 'Failed to create room');
      }
    });

    // Join Room
    socket.on('join_room', async ({ roomCode }: { roomCode: string }) => {
      try {
        const code = roomCode.toUpperCase();
        const roomData = await redis.get(`room:${code}`);
        if (!roomData) {
          return socket.emit('error', 'Room not found');
        }

        const room: RoomState = JSON.parse(roomData);
        if (room.status !== 'lobby') {
          return socket.emit('error', 'Game has already started');
        }

        if (room.players.some((p) => p.userId === userId)) {
          // Already in the room
          socket.join(code);
          return socket.emit('room_joined', room);
        }

        room.players.push({
          userId,
          username,
          progress: 0,
          isResigned: false,
          isFinished: false,
          completionTime: null,
          mistakes: 0,
        });

        await redis.set(`room:${code}`, JSON.stringify(room));
        socket.join(code);
        io.to(code).emit('room_joined', room);
      } catch (err) {
        console.error('Join room error:', err);
        socket.emit('error', 'Failed to join room');
      }
    });

    // Start Game
    socket.on('start_game', async ({ roomCode }: { roomCode: string }) => {
      try {
        const code = roomCode.toUpperCase();
        const roomData = await redis.get(`room:${code}`);
        if (!roomData) return socket.emit('error', 'Room not found');

        const room: RoomState = JSON.parse(roomData);
        if (room.players[0].userId !== userId) {
          return socket.emit('error', 'Only host can start the game');
        }

        room.status = 'playing';
        room.startTime = Date.now();
        await redis.set(`room:${code}`, JSON.stringify(room));

        io.to(code).emit('game_started', room);
      } catch (err) {
        console.error('Start game error:', err);
      }
    });

    // Validate and submit cell entry
    socket.on(
      'submit_cell',
      async ({
        roomCode,
        row,
        col,
        val,
        currentBoard,
      }: {
        roomCode: string;
        row: number;
        col: number;
        val: number;
        currentBoard: number[][];
      }) => {
        try {
          const code = roomCode.toUpperCase();
          const roomData = await redis.get(`room:${code}`);
          if (!roomData) return socket.emit('error', 'Room not found');

          const room: RoomState = JSON.parse(roomData);
          if (room.status !== 'playing') return socket.emit('error', 'Game is not active');

          const isCorrect = verifyCell(room.solution, row, col, val);
          const playerIndex = room.players.findIndex((p) => p.userId === userId);
          
          socket.emit('cell_validation', { row, col, val, isCorrect });

          if (playerIndex !== -1) {
            if (isCorrect) {
              // Recalculate progress
              const progressInfo = getCompletionProgress(room.solution, currentBoard);
              room.players[playerIndex].progress = progressInfo.progressPercentage;

              // Check if player solved the puzzle
              if (progressInfo.isComplete && !room.players[playerIndex].isFinished) {
                room.players[playerIndex].isFinished = true;
                room.players[playerIndex].completionTime = Math.round(
                  (Date.now() - (room.startTime || Date.now())) / 1000
                );
                
                io.to(code).emit('player_finished', {
                  userId,
                  username,
                  completionTime: room.players[playerIndex].completionTime,
                });

                // First player completion immediately ends the match for everyone
                await finishGame(room, redis);
                return;
              }

              await redis.set(`room:${code}`, JSON.stringify(room));
              // Broadcast live progress change to others in room
              io.to(code).emit('progress_update', {
                userId,
                username,
                progress: progressInfo.progressPercentage,
              });
            } else {
              // Increment mistake count
              room.players[playerIndex].mistakes += 1;
              const currentMistakes = room.players[playerIndex].mistakes;
              
              io.to(code).emit('mistake_update', {
                userId,
                username,
                mistakes: currentMistakes,
              });

              // Check for elimination
              if (room.maxMistakes > 0 && currentMistakes >= room.maxMistakes) {
                room.players[playerIndex].isResigned = true;
                io.to(code).emit('player_eliminated', {
                  userId,
                  username,
                  reason: 'Exceeded mistake limit',
                });

                // Check if all players completed or resigned/eliminated
                const activePlayers = room.players.filter((p) => !p.isResigned && !p.isFinished);
                if (activePlayers.length === 0) {
                  await finishGame(room, redis);
                  return;
                }
              }

              await redis.set(`room:${code}`, JSON.stringify(room));
            }
          }
        } catch (err) {
          console.error('Cell submission error:', err);
        }
      }
    );

    // Resign Game
    socket.on('resign_game', async ({ roomCode }: { roomCode: string }) => {
      try {
        const code = roomCode.toUpperCase();
        const roomData = await redis.get(`room:${code}`);
        if (!roomData) return;

        const room: RoomState = JSON.parse(roomData);
        if (room.status !== 'playing') return;

        const playerIndex = room.players.findIndex((p) => p.userId === userId);
        if (playerIndex !== -1) {
          room.players[playerIndex].isResigned = true;
          io.to(code).emit('player_resigned', { userId, username });

          const activePlayers = room.players.filter((p) => !p.isResigned && !p.isFinished);
          if (activePlayers.length === 0) {
            await finishGame(room, redis);
          } else {
            await redis.set(`room:${code}`, JSON.stringify(room));
          }
        }
      } catch (err) {
        console.error('Resign error:', err);
      }
    });

    // Chat message relay
    socket.on('send_message', async ({ roomCode, text }: { roomCode: string; text: string }) => {
      if (!text || text.trim() === '') return;
      const code = roomCode.toUpperCase();
      io.to(code).emit('receive_message', {
        userId,
        username,
        text: text.trim(),
        timestamp: Date.now(),
      });
    });

    // Disconnection logic
    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: ${username}`);
      await redis.del(`socket:${socket.id}`);

      const activeSocketId = await redis.get(`user:active-socket:${userId}`);
      if (activeSocketId === socket.id) {
        await redis.del(`user:active-socket:${userId}`);
      }

      const room = await findUserRoom(userId);
      if (room && room.status === 'playing') {
        io.to(room.roomCode).emit('player_disconnected', { userId, username });

        // Set a 60 second reconnection timer
        const timer = setTimeout(async () => {
          console.log(`User ${username} failed to reconnect in 60s, resigning automatically...`);
          activeReconnectionTimers.delete(userId);

          // Force resign the player
          const updatedRoomData = await redis.get(`room:${room.roomCode}`);
          if (updatedRoomData) {
            const updatedRoom: RoomState = JSON.parse(updatedRoomData);
            const pIdx = updatedRoom.players.findIndex((p) => p.userId === userId);
            if (pIdx !== -1 && !updatedRoom.players[pIdx].isResigned && !updatedRoom.players[pIdx].isFinished) {
              updatedRoom.players[pIdx].isResigned = true;
              io.to(room.roomCode).emit('player_resigned', { userId, username });

              const active = updatedRoom.players.filter((p) => !p.isResigned && !p.isFinished);
              if (active.length === 0) {
                await finishGame(updatedRoom, redis);
              } else {
                await redis.set(`room:${room.roomCode}`, JSON.stringify(updatedRoom));
              }
            }
          }
        }, 60000);

        activeReconnectionTimers.set(userId, timer);
      }
    });
  });
}

// Persist Match outcomes to MongoDB and clean up room
async function finishGame(room: RoomState, redis: any) {
  try {
    room.status = 'finished';
    
    // Find winner
    const finishedPlayers = room.players.filter((p) => p.isFinished && p.completionTime !== null);
    let winner: PlayerState | null = null;
    if (finishedPlayers.length > 0) {
      // Sort by completion time (ascending)
      finishedPlayers.sort((a, b) => (a.completionTime || 0) - (b.completionTime || 0));
      winner = finishedPlayers[0];
    }

    await connectToDatabase();

    // Update Player Stats
    for (const p of room.players) {
      const isWinner = winner && winner.userId === p.userId;
      const user = await User.findById(p.userId);
      if (user) {
        user.stats.gamesPlayed += 1;
        if (isWinner) {
          user.stats.gamesWon += 1;
        }
        
        // Update personal best time for difficulty
        if (p.isFinished && p.completionTime !== null) {
          const prevBest = user.stats.bestTimes[room.difficulty];
          if (prevBest === null || p.completionTime < prevBest) {
            user.stats.bestTimes[room.difficulty] = p.completionTime;
          }
        }
        await user.save();
      }
    }

    // Broadcast finished status
    if (ioInstance) {
      ioInstance.to(room.roomCode).emit('game_finished', { roomCode: room.roomCode });
    }

    // Remove room from Redis cache
    await redis.del(`room:${room.roomCode}`);
  } catch (err) {
    console.error('Error finishing game:', err);
  }
}
