'use client';

import React, { use, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSocket } from '@/lib/socket';

interface Player {
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
  players: Player[];
  startBoard: number[][];
  solution: number[][];
  startTime: number | null;
  maxMistakes: number;
}

interface ChatMessage {
  userId: string;
  username: string;
  text: string;
  timestamp: number;
}

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = use(params);
  const roomCode = resolvedParams.code;

  const [room, setRoom] = useState<RoomState | null>(null);
  const [board, setBoard] = useState<number[][]>([]);
  const [errorCells, setErrorCells] = useState<boolean[][]>(
    Array.from({ length: 9 }, () => Array(9).fill(false))
  );
  const [userId, setUserId] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  
  // Highlighting & interface controls states
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'board' | 'progress' | 'chat'>('board');
  
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const socket = getSocket();

  // Scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Authenticate session
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch('/api/profile');
        if (!res.ok) {
          router.push('/');
          return;
        }
        const data = await res.json();
        setUserId(data.user.id);
        setUsername(data.user.username);
      } catch (err) {
        router.push('/');
      }
    };
    fetchSession();
  }, [router]);

  // Sync Timer interval
  useEffect(() => {
    if (!room || room.status !== 'playing' || !room.startTime) {
      setElapsedTime(0);
      return;
    }

    const interval = setInterval(() => {
      const seconds = Math.max(0, Math.floor((Date.now() - room.startTime!) / 1000));
      setElapsedTime(seconds);
    }, 1000);

    return () => clearInterval(interval);
  }, [room]);

  // Arrow hotkeys listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (room?.status !== 'playing') return;
      if (document.activeElement?.tagName === 'INPUT' && !document.activeElement.classList.contains('sudoku-input')) {
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCell((prev) => (prev ? { row: Math.max(0, prev.row - 1), col: prev.col } : { row: 0, col: 0 }));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCell((prev) => (prev ? { row: Math.min(8, prev.row + 1), col: prev.col } : { row: 8, col: 0 }));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedCell((prev) => (prev ? { row: prev.row, col: Math.max(0, prev.col - 1) } : { row: 0, col: 0 }));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedCell((prev) => (prev ? { row: prev.row, col: Math.min(8, prev.col + 1) } : { row: 0, col: 8 }));
      } else if (e.key >= '1' && e.key <= '9') {
        if (selectedCell) {
          const isFixed = room.startBoard[selectedCell.row][selectedCell.col] !== 0;
          if (!isFixed) {
            handleCellChange(selectedCell.row, selectedCell.col, e.key);
          }
        }
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectedCell) {
          const isFixed = room.startBoard[selectedCell.row][selectedCell.col] !== 0;
          if (!isFixed) {
            handleCellChange(selectedCell.row, selectedCell.col, '');
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCell, room, board]);

  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }

    socket.emit('join_room', { roomCode });

    socket.on('room_joined', (updatedRoom: RoomState) => {
      setRoom(updatedRoom);
      setBoard(updatedRoom.startBoard.map(row => [...row]));
    });

    socket.on('game_started', (updatedRoom: RoomState) => {
      setRoom(updatedRoom);
      setBoard(updatedRoom.startBoard.map(row => [...row]));
    });

    socket.on('progress_update', ({ userId: updateId, progress }: { userId: string; progress: number }) => {
      setRoom((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          players: prev.players.map((p) =>
            p.userId === updateId ? { ...p, progress } : p
          ),
        };
      });
    });

    socket.on('player_finished', ({ userId: finishedId, completionTime }: { userId: string; completionTime: number }) => {
      setRoom((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          players: prev.players.map((p) =>
            p.userId === finishedId ? { ...p, isFinished: true, completionTime } : p
          ),
        };
      });
    });

    socket.on('player_resigned', ({ userId: resignedId }: { userId: string }) => {
      setRoom((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          players: prev.players.map((p) =>
            p.userId === resignedId ? { ...p, isResigned: true } : p
          ),
        };
      });
    });

    socket.on('mistake_update', ({ userId: updateId, mistakes }: { userId: string; mistakes: number }) => {
      setRoom((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          players: prev.players.map((p) =>
            p.userId === updateId ? { ...p, mistakes } : p
          ),
        };
      });
    });

    socket.on('player_eliminated', ({ userId: eliminatedId, username: eliminatedName, reason }: { userId: string; username: string; reason: string }) => {
      setRoom((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          players: prev.players.map((p) =>
            p.userId === eliminatedId ? { ...p, isResigned: true } : p
          ),
        };
      });

      setChatMessages((prev) => [
        ...prev,
        {
          userId: 'system',
          username: 'System',
          text: `🚨 ${eliminatedName} has been ELIMINATED! (${reason})`,
          timestamp: Date.now(),
        },
      ]);
    });

    socket.on('cell_validation', ({ row, col, val, isCorrect }: { row: number; col: number; val: number; isCorrect: boolean }) => {
      if (isCorrect) {
        setBoard((prev) => {
          const next = prev.map(r => [...r]);
          next[row][col] = val;
          return next;
        });
        setErrorCells((prev) => {
          const next = prev.map(r => [...r]);
          next[row][col] = false;
          return next;
        });
      } else {
        setErrorCells((prev) => {
          const next = prev.map(r => [...r]);
          next[row][col] = true;
          return next;
        });
      }
    });

    socket.on('receive_message', (msg: ChatMessage) => {
      setChatMessages((prev) => [...prev, msg]);
    });

    socket.on('game_finished', (match: any) => {
      setRoom((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          status: 'finished',
        };
      });
    });

    socket.on('error', (err: string) => {
      alert(err);
      router.push('/lobby');
    });

    socket.on('session_kick', ({ message }: { message: string }) => {
      alert(message);
      fetch('/api/auth/logout', { method: 'POST' }).then(() => {
        router.push('/');
      });
    });

    return () => {
      socket.off('room_joined');
      socket.off('game_started');
      socket.off('progress_update');
      socket.off('player_finished');
      socket.off('player_resigned');
      socket.off('mistake_update');
      socket.off('player_eliminated');
      socket.off('cell_validation');
      socket.off('receive_message');
      socket.off('game_finished');
      socket.off('error');
      socket.off('session_kick');
    };
  }, [socket, roomCode, router]);

  const handleStartGame = () => {
    socket.emit('start_game', { roomCode });
  };

  const handleCellChange = (row: number, col: number, valueStr: string) => {
    const val = parseInt(valueStr, 10);
    if (isNaN(val) || val < 1 || val > 9) {
      if (valueStr === '') {
        setBoard((prev) => {
          const next = prev.map(r => [...r]);
          next[row][col] = 0;
          return next;
        });
        setErrorCells((prev) => {
          const next = prev.map(r => [...r]);
          next[row][col] = false;
          return next;
        });
      }
      return;
    }

    const updatedBoard = board.map(r => [...r]);
    updatedBoard[row][col] = val;

    socket.emit('submit_cell', {
      roomCode,
      row,
      col,
      val,
      currentBoard: updatedBoard,
    });
  };

  const handleCellClick = (row: number, col: number) => {
    const isFixed = room?.startBoard[row][col] !== 0;
    if (isFixed) return;

    if (selectedNumber !== null) {
      handleCellChange(row, col, String(selectedNumber));
    } else {
      setSelectedCell({ row, col });
    }
  };

  const handleKeypadClick = (num: number) => {
    if (selectedCell) {
      const isFixed = room?.startBoard[selectedCell.row][selectedCell.col] !== 0;
      if (!isFixed) {
        handleCellChange(selectedCell.row, selectedCell.col, String(num));
      }
    } else {
      setSelectedNumber((prev) => (prev === num ? null : num));
    }
  };

  const handleResign = () => {
    if (confirm('Are you sure you want to resign the match?')) {
      socket.emit('resign_game', { roomCode });
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    socket.emit('send_message', { roomCode, text: chatInput });
    setChatInput('');
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Remaining correct numbers count
  const getRemainingCounts = () => {
    const counts: Record<number, number> = { 1: 9, 2: 9, 3: 9, 4: 9, 5: 9, 6: 9, 7: 9, 8: 9, 9: 9 };
    if (!room) return counts;

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = board[r]?.[c];
        if (val && val !== 0 && room.solution[r]?.[c] === val) {
          counts[val] = Math.max(0, counts[val] - 1);
        }
      }
    }
    return counts;
  };

  const remainingCounts = getRemainingCounts();
  const isHost = room?.players[0]?.userId === userId;
  const localPlayer = room?.players.find((p) => p.userId === userId);
  const isEliminated = localPlayer?.isResigned && !localPlayer?.isFinished;

  // Same value highlight selector
  const selectedCellValue = selectedCell ? board[selectedCell.row]?.[selectedCell.col] : null;

  if (!room) {
    return (
      <div className="auth-container">
        <div style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>Connecting to match...</div>
      </div>
    );
  }

  // Lobby view
  if (room.status === 'lobby') {
    return (
      <div className="auth-container">
        <div className="glass-panel" style={{ width: '100%', maxWidth: '500px' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '0.5rem', textAlign: 'center' }}>Game Lobby</h1>
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '1.5rem' }}>
            Room Code: <strong style={{ color: 'var(--primary)', letterSpacing: '2px', fontSize: '1.2rem' }}>{room.roomCode}</strong>
          </p>

          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Joined Players:</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {room.players.map((p, idx) => (
                <div key={p.userId} style={{ padding: '0.8rem', background: '#f8fafc', border: '1px solid var(--panel-border)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: '500' }}>{p.username}</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{idx === 0 ? 'Host' : 'Challenger'}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem', fontSize: '0.95rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Difficulty:</span>
              <span style={{ fontWeight: '600', textTransform: 'capitalize' }}>{room.difficulty}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Mistake Limit:</span>
              <span style={{ fontWeight: '600' }}>{room.maxMistakes > 0 ? `${room.maxMistakes} Mistakes` : 'Unlimited (Practice)'}</span>
            </div>
          </div>

          {isHost ? (
            <button className="btn btn-primary" onClick={handleStartGame} disabled={room.players.length < 1}>
              Start Match
            </button>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              Waiting for host to start...
            </div>
          )}
        </div>
      </div>
    );
  }

  // Active game view
  return (
    <div className="sudoku-container animate-fade-slide">
      
      {/* Column 1: Board Wrapper */}
      <div className={`board-wrapper ${activeTab === 'board' ? '' : 'hidden-mobile-view'}`}>
        <div className="glass-panel" style={{ width: '100%', maxWidth: '540px', padding: '1.5rem' }}>
          
          {room.status === 'playing' ? (
            isEliminated ? (
              <div style={{ padding: '6rem 1rem', textAlign: 'center', background: 'var(--danger-bg)', borderRadius: '12px', border: '1px dashed var(--danger)', marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '2.5rem', color: 'var(--danger)', marginBottom: '1rem', fontWeight: '800' }}>ELIMINATED</h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                  You exceeded the limit of {room.maxMistakes} mistakes.
                </p>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  You can still spectate the match progress and chat with others!
                </p>
              </div>
            ) : (
              <>
                {/* Mobile mistakes & stopwatch display */}
                <div className="mobile-only-header" style={{ justifyContent: 'space-between', marginBottom: '0.8rem', fontSize: '0.9rem', fontWeight: '700' }}>
                  <span>Mistakes: {localPlayer?.mistakes ?? 0}/{room.maxMistakes}</span>
                  <span style={{ color: 'var(--primary)' }}>⏱️ {formatTimer(elapsedTime)}</span>
                </div>

                <div className="sudoku-grid">
                  {board.map((rowArr, rIdx) =>
                    rowArr.map((cellVal, cIdx) => {
                      const isFixed = room.startBoard[rIdx][cIdx] !== 0;
                      const isError = errorCells[rIdx][cIdx];

                      // Compute Highlights
                      const isSelected = selectedCell && selectedCell.row === rIdx && selectedCell.col === cIdx;
                      const isHighlightAxis = selectedCell && (selectedCell.row === rIdx || selectedCell.col === cIdx);
                      const isHighlightBox = selectedCell && (
                        Math.floor(selectedCell.row / 3) === Math.floor(rIdx / 3) &&
                        Math.floor(selectedCell.col / 3) === Math.floor(cIdx / 3)
                      );
                      const isSameValue = selectedCellValue && selectedCellValue !== 0 && cellVal === selectedCellValue;

                      let cellClass = '';
                      if (isSelected) cellClass = 'selected';
                      else if (isSameValue) cellClass = 'highlight-same-value';
                      else if (isHighlightBox) cellClass = 'highlight-box';
                      else if (isHighlightAxis) cellClass = 'highlight-axis';

                      return (
                        <div
                          key={`${rIdx}-${cIdx}`}
                          className={`sudoku-cell ${cellClass}`}
                          onClick={() => handleCellClick(rIdx, cIdx)}
                        >
                          <input
                            type="text"
                            maxLength={1}
                            className={`sudoku-input ${isFixed ? 'fixed' : ''} ${isError ? 'error' : ''}`}
                            value={cellVal === 0 ? '' : cellVal}
                            onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                            onFocus={() => setSelectedCell({ row: rIdx, col: cIdx })}
                            disabled={isFixed || room.status === 'finished'}
                            style={{ pointerEvents: selectedNumber !== null ? 'none' : 'auto' }}
                          />
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Horizontal mobile-only keypad row of 9 buttons */}
                <div className="mobile-horizontal-keypad">
                  {([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((num) => {
                    const count = remainingCounts[num];
                    const isCompleted = count === 0;
                    return (
                      <button
                        key={num}
                        className={`keypad-row-btn ${selectedNumber === num ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                        onClick={() => !isCompleted && handleKeypadClick(num)}
                        disabled={isCompleted}
                      >
                        <span className="keypad-row-digit">{num}</span>
                        <span className="keypad-row-count">{isCompleted ? '✓' : count}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )
          ) : (
            <div style={{ padding: '3.5rem 1rem', textAlign: 'center' }}>
              <h1 style={{ fontSize: '2.5rem', color: 'var(--success)', marginBottom: '1rem', fontWeight: '800' }}>Game Finished!</h1>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem' }}>All players have finished or resigned.</p>
              <button className="btn btn-primary" onClick={() => router.push('/lobby')}>
                Return to Lobby
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Column 2: Controls Sidebar (Mistakes + Desktop Numpad) */}
      <div className="game-sidebar">
        
        {/* Game Stats & Timer Clock */}
        <div className="glass-panel" style={{ padding: '1.2rem 1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase' }}>Mistakes</span>
              <div style={{ fontSize: '1.25rem', fontWeight: '800' }}>
                {localPlayer ? localPlayer.mistakes : 0}
                {room.maxMistakes > 0 ? `/${room.maxMistakes}` : ''}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase' }}>Elapsed Time</span>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', fontFamily: 'monospace', color: 'var(--primary)' }}>
                ⏱️ {formatTimer(elapsedTime)}
              </div>
            </div>
          </div>
        </div>

        {/* Desktop 3x3 Keypad */}
        {room.status === 'playing' && !isEliminated && (
          <div className="glass-panel desktop-keypad-panel" style={{ padding: '1.2rem' }}>
            <div className="keypad-container">
              {([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((num) => {
                const count = remainingCounts[num];
                const isCompleted = count === 0;
                return (
                  <button
                    key={num}
                    className={`keypad-btn ${selectedNumber === num ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                    onClick={() => !isCompleted && handleKeypadClick(num)}
                    disabled={isCompleted}
                  >
                    <span>{num}</span>
                    <span className="keypad-count">{isCompleted ? '✓' : count}</span>
                  </button>
                );
              })}
            </div>
            
            <button
              className="btn btn-secondary"
              style={{ marginTop: '1rem', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
              onClick={handleResign}
            >
              Resign Game
            </button>
          </div>
        )}
      </div>

      {/* Column 3: Stats & Chat Sidebar (Competitors + Live Chat) */}
      <div className={`game-sidebar ${activeTab !== 'board' ? 'active-tab-visible' : ''}`}>
        
        {/* Competitor list */}
        {(activeTab === 'progress' || (typeof window !== 'undefined' && window.innerWidth >= 768)) && (
          <div className="glass-panel sidebar-section">
            <h2 className="sidebar-title">Players Progress</h2>
            <div className="opponent-progress">
              {room.players.map((p) => (
                <div key={p.userId} className="opponent-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', marginBottom: '0.3rem' }}>
                    <span style={{ fontWeight: p.userId === userId ? '700' : '500' }}>
                      {p.username} {p.userId === userId && '(You)'}
                    </span>
                    <span style={{ fontWeight: '600', color: p.isResigned ? 'var(--danger)' : p.isFinished ? 'var(--success)' : 'var(--primary)' }}>
                      {p.isResigned ? 'Failed' : p.isFinished ? `Done (${p.completionTime}s)` : `${p.progress}%`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    <span>Mistakes: {p.mistakes}{room.maxMistakes > 0 ? `/${room.maxMistakes}` : ''}</span>
                    <span>Solved: {p.progress}%</span>
                  </div>
                  {!p.isResigned && (
                    <div className="progress-bar-container">
                      <div className="progress-bar-fill" style={{ width: `${p.progress}%` }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live Chat */}
        {(activeTab === 'chat' || (typeof window !== 'undefined' && window.innerWidth >= 768)) && (
          <div className="glass-panel chat-container" style={{ padding: '0' }}>
            <div style={{ padding: '0.9rem 1.2rem', borderBottom: '1px solid var(--panel-border)', fontWeight: '700', fontSize: '1rem', background: '#ffffff' }}>Live Chat</div>
            <div className="chat-messages">
              {chatMessages.map((msg, index) => {
                const isSys = msg.userId === 'system';
                return (
                  <div key={index} className={`chat-msg ${isSys ? 'system-msg' : ''}`}>
                    {!isSys && <div className="chat-msg-username">{msg.username}</div>}
                    <div>{msg.text}</div>
                  </div>
                );
              })}
              <div ref={chatBottomRef} />
            </div>
            <form onSubmit={handleSendMessage} className="chat-input-wrapper">
              <input
                type="text"
                placeholder="Type a message..."
                className="form-input"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                style={{ padding: '0.65rem' }}
              />
              <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '0.65rem 1.1rem' }}>
                Send
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Premium responsive Tab Navigation Bar */}
      <div className="mobile-tabs">
        <button
          className={`tab-btn ${activeTab === 'board' ? 'active' : ''}`}
          onClick={() => setActiveTab('board')}
        >
          🎮 Board
        </button>
        <button
          className={`tab-btn ${activeTab === 'progress' ? 'active' : ''}`}
          onClick={() => setActiveTab('progress')}
        >
          📊 Stats
        </button>
        <button
          className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          💬 Chat
        </button>
      </div>

    </div>
  );
}
