import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth.store';

/**
 * Custom hook to interact with Socket.io server.
 *
 * WHY custom hook: Centralizes connection lifecycle, prevents multiple connections,
 * handles token authentication at socket level, and handles cleanup on unmount.
 */
export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    // Only initialize socket if not already connected/connecting
    if (!socketRef.current) {
      // Connect to the same host/port proxied by Vite
      socketRef.current = io('/', {
        auth: { token: accessToken },
        transports: ['websocket'],
      });

      socketRef.current.on('connect', () => {
        setIsConnected(true);
      });

      socketRef.current.on('disconnect', () => {
        setIsConnected(false);
      });

      socketRef.current.on('connect_error', () => {
        setIsConnected(false);
      });
    }

    return () => {
      // We do not disconnect on every effect run to avoid reconnect churn,
      // but clean up when user logs out or leaves page
    };
  }, [accessToken]);

  // Join a repository room to receive run updates
  const joinRepo = (repoId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('join:repo', repoId);
    }
  };

  const leaveRepo = (repoId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('leave:repo', repoId);
    }
  };

  // Join specific run to receive live build logs
  const joinRun = (runId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('join:run', runId);
    }
  };

  const leaveRun = (runId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('leave:run', runId);
    }
  };

  // Listen to specific socket events
  const on = (event: string, callback: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
  };

  const off = (event: string, callback?: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.off(event, callback);
    }
  };

  return {
    isConnected,
    joinRepo,
    leaveRepo,
    joinRun,
    leaveRun,
    on,
    off,
  };
};
