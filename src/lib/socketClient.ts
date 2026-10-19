import { io, Socket } from 'socket.io-client';

export interface DriverLocationUpdate {
  driverId: string;
  fullName: string;
  latitude: number;
  longitude: number;
  batteryLevel?: number | null;
  shiftId?: string | null;
  timestamp?: string | Date;
  trackingLogId?: string;
}

type LocationCallback = (data: DriverLocationUpdate) => void;

let socket: Socket | null = null;
const listeners = new Set<LocationCallback>();

/**
 * Determine WebSocket server URL
 * Trims '/api' suffix if NEXT_PUBLIC_API_URL includes it, since Socket.io connects to root.
 */
export function getSocketUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!envUrl || envUrl.trim() === '') {
    return 'http://localhost:3001';
  }
  return envUrl.replace(/\/api\/?$/, '');
}

/**
 * Connect to backend Socket.io gateway with auth token
 */
export function connectSocket(token: string): Socket {
  if (socket?.connected) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
  }

  const url = getSocketUrl();
  socket = io(url, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log('[SocketClient] Connected to backend gateway, socket ID:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[SocketClient] Disconnected from backend gateway:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('[SocketClient] Connection error:', error.message);
  });

  // Re-attach any registered listeners
  listeners.forEach((callback) => {
    socket?.on('driver_location_updated', callback);
  });

  return socket;
}

/**
 * Disconnect socket and clean up
 */
export function disconnectSocket(): void {
  if (socket) {
    listeners.forEach((callback) => {
      socket?.off('driver_location_updated', callback);
    });
    socket.disconnect();
    socket = null;
  }
}

/**
 * Subscribe to driver_location_updated events broadcasted from backend
 */
export function onDriverLocationUpdated(callback: LocationCallback): () => void {
  listeners.add(callback);

  if (socket) {
    socket.on('driver_location_updated', callback);
  }

  return () => {
    listeners.delete(callback);
    socket?.off('driver_location_updated', callback);
  };
}

export function getSocket(): Socket | null {
  return socket;
}

export const socketClient = {
  connectSocket,
  disconnectSocket,
  onDriverLocationUpdated,
  getSocket,
  getSocketUrl,
};

export default socketClient;
