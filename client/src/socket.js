// Socket.io singleton — one connection for the whole app.
import { io } from "socket.io-client";
import { getToken } from "./api";

let socket = null;

export function connectSocket() {
  if (socket && socket.connected) return socket;
  if (socket) socket.disconnect();
  socket = io(import.meta.env.VITE_SERVER_URL || undefined, {
    auth: { token: getToken() },
    reconnection: true,
    reconnectionDelay: 1000,
  });
  return socket;
}

export function getSocket() { return socket; }

export function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}
