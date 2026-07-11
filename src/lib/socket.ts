import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    // Connect to the same host that serves the site
    socket = io({
      autoConnect: false,
      reconnectionAttempts: 5,
    });
  }
  return socket;
}
