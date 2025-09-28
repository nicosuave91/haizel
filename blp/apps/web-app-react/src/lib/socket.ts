import { io, type Socket } from "socket.io-client";

let socket: Socket | undefined;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io("/", { autoConnect: false });
  }
  return socket;
};

export const connectSocket = (): Socket => {
  const client = getSocket();
  if (!client.connected) {
    client.connect();
  }
  return client;
};

export const disconnectSocket = (): void => {
  if (socket?.connected) {
    socket.disconnect();
  }
};
