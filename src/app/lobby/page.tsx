'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSocket } from '@/lib/socket';

interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
  bestTimes: {
    easy: number | null;
    medium: number | null;
    hard: number | null;
    expert: number | null;
  };
}

interface UserProfile {
  id: string;
  username: string;
  stats: UserStats;
}

export default function LobbyPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'expert'>('easy');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [joinError, setJoinError] = useState('');
  const [creating, setCreating] = useState(false);
  const [maxMistakes, setMaxMistakes] = useState<number>(3);

  const router = useRouter();
  const socket = getSocket();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/profile');
        if (!res.ok) {
          router.push('/');
          return;
        }
        const data = await res.json();
        setUser(data.user);
      } catch (err) {
        router.push('/');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [router]);

  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }

    socket.on('room_created', (room: { roomCode: string }) => {
      router.push(`/room/${room.roomCode}`);
    });

    socket.on('error', (err: string) => {
      setJoinError(err);
      setCreating(false);
    });

    socket.on('session_kick', ({ message }: { message: string }) => {
      alert(message);
      fetch('/api/auth/logout', { method: 'POST' }).then(() => {
        router.push('/');
      });
    });

    return () => {
      socket.off('room_created');
      socket.off('error');
      socket.off('session_kick');
    };
  }, [socket, router]);

  const handleCreateRoom = () => {
    setCreating(true);
    socket.emit('create_room', { difficulty, maxMistakes });
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCodeInput.trim()) return;
    router.push(`/room/${roomCodeInput.toUpperCase().trim()}`);
  };

  const formatBestTime = (time: number | null) => {
    if (time === null) return 'N/A';
    const mins = Math.floor(time / 60);
    const secs = time % 60;
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="auth-container">
        <div style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>Loading lobby...</div>
      </div>
    );
  }

  return (
    <div className="lobby-container animate-fade-slide">
      <div className="lobby-header">
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Sudoku Multiplayer</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Welcome back, <strong style={{ color: 'var(--primary)' }}>{user?.username}</strong>!</p>
        </div>
        <button
          className="btn btn-secondary"
          style={{ width: 'auto', padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}
          onClick={async () => {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.push('/');
          }}
        >
          Logout
        </button>
      </div>

      <div className="lobby-grid">
        {/* Create Room Container */}
        <div className="glass-panel">
          <h2 style={{ marginBottom: '1.2rem', fontSize: '1.4rem', fontWeight: '700' }}>Create a Match</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
            Set up a custom multiplayer room, choose game difficulty, and share the lobby link to compete.
          </p>

          <div style={{ marginBottom: '1.8rem' }}>
            <label className="form-label" style={{ fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block', color: 'var(--text-secondary)' }}>
              Difficulty
            </label>
            <div className="difficulty-selector">
              {(['easy', 'medium', 'hard', 'expert'] as const).map((diff) => (
                <button
                  key={diff}
                  className={`difficulty-btn ${difficulty === diff ? 'active' : ''}`}
                  onClick={() => setDifficulty(diff)}
                >
                  {diff.charAt(0).toUpperCase() + diff.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '2.2rem' }}>
            <label className="form-label" style={{ fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block', color: 'var(--text-secondary)' }}>
              Mistake Limit (Forfeit Rule)
            </label>
            <select
              className="form-input"
              value={maxMistakes}
              onChange={(e) => setMaxMistakes(parseInt(e.target.value, 10))}
              style={{ cursor: 'pointer' }}
            >
              <option value={3}>3 Mistakes (Recommended)</option>
              <option value={5}>5 Mistakes</option>
              <option value={0}>Unlimited Mistakes (Practice)</option>
            </select>
          </div>

          <button
            className="btn btn-primary"
            style={{ padding: '1.1rem' }}
            onClick={handleCreateRoom}
            disabled={creating}
          >
            {creating ? 'Creating Lobby...' : 'Create Match Room'}
          </button>
        </div>

        {/* Join Room & User Stats Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel">
            <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: '700' }}>Join Match</h2>
            {joinError && (
              <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{joinError}</p>
            )}
            <form onSubmit={handleJoinRoom}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter 6-character room code"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value)}
                  style={{ textTransform: 'uppercase', letterSpacing: '1px' }}
                  required
                />
              </div>
              <button type="submit" className="btn btn-secondary">
                Join Room
              </button>
            </form>
          </div>

          <div className="glass-panel">
            <h2 style={{ marginBottom: '1.2rem', fontSize: '1.25rem', fontWeight: '700' }}>Your Statistics</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Games Played</span>
                <span style={{ fontWeight: '700' }}>{user?.stats.gamesPlayed}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '0.6rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Games Won</span>
                <span style={{ fontWeight: '700', color: 'var(--success)' }}>{user?.stats.gamesWon}</span>
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', marginTop: '0.5rem' }}>
                Personal Records (Solve Speeds)
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Easy</span>
                <span style={{ fontWeight: '600' }}>{formatBestTime(user?.stats.bestTimes.easy ?? null)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Medium</span>
                <span style={{ fontWeight: '600' }}>{formatBestTime(user?.stats.bestTimes.medium ?? null)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Hard</span>
                <span style={{ fontWeight: '600' }}>{formatBestTime(user?.stats.bestTimes.hard ?? null)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Expert</span>
                <span style={{ fontWeight: '600' }}>{formatBestTime(user?.stats.bestTimes.expert ?? null)}</span>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Developed with ♥ by{' '}
            <a
              href="https://github.com/RajV95"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: '600' }}
            >
              Rajvardhan
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
