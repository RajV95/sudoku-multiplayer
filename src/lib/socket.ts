import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    // Connect using WebSocket transport directly to avoid polling spam
    socket = io({
      autoConnect: false,
      reconnectionAttempts: 5,
      transports: ['websocket'],
    });
  }
  return socket;
}
