import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { jwt_util } from '../shared/utils/jwt';
import { logger } from '../config/logger';

let io: Server | null = null;

/**
 * Socket.io Server Initialization
 *
 * WHY Socket.io over raw WebSockets:
 * - Built-in connection state recovery and automatic reconnects
 * - Room abstraction (perfect for pipeline run log streaming and repo rooms)
 * - Fallbacks to HTTP polling if WebSocket is blocked (e.g. strict corporate proxies)
 * - Built-in heartbeats / ping-pong out of the box
 */
export const initSocketServer = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: [process.env.FRONTEND_URL ?? 'http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  // ── Authentication Middleware ─────────────────────────────────────────────
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      return next(new Error('Authentication error: Token required'));
    }

    try {
      // Decode JWT access token
      const user = jwt_util.verifyAccessToken(token);
      (socket as any).user = user;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  // ── Connection Handler ────────────────────────────────────────────────────
  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    logger.info(`[Socket] Client connected: user=${user.email} socketId=${socket.id}`);

    // Join organization or repo rooms to get run list updates
    socket.on('join:repo', (repoId: string) => {
      socket.join(`repo:${repoId}`);
      logger.debug(`[Socket] Socket ${socket.id} joined room repo:${repoId}`);
    });

    socket.on('leave:repo', (repoId: string) => {
      socket.leave(`repo:${repoId}`);
      logger.debug(`[Socket] Socket ${socket.id} left room repo:${repoId}`);
    });

    // Join specific pipeline run to stream live logs
    socket.on('join:run', (runId: string) => {
      socket.join(`run:${runId}`);
      logger.debug(`[Socket] Socket ${socket.id} joined room run:${runId}`);
    });

    socket.on('leave:run', (runId: string) => {
      socket.leave(`run:${runId}`);
      logger.debug(`[Socket] Socket ${socket.id} left room run:${runId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`[Socket] Client disconnected: socketId=${socket.id}`);
    });
  });

  logger.info('⚡ Socket.io server initialized');
  return io;
};

/**
 * Helper to emit events to specific rooms.
 */
export const emitToRoom = (room: string, event: string, data: any) => {
  if (!io) {
    logger.warn('[Socket] Tried to emit to room before initialization');
    return;
  }
  io.to(room).emit(event, data);
};

/**
 * Helper to emit a new pipeline run update to repository room.
 */
export const emitPipelineUpdate = (repoId: string, data: any) => {
  emitToRoom(`repo:${repoId}`, 'pipeline:update', data);
};

/**
 * Helper to stream log chunks to clients viewing a run.
 */
export const emitLogChunk = (runId: string, content: string) => {
  emitToRoom(`run:${runId}`, 'log:chunk', { runId, content, createdAt: new Date() });
};

export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.io server not initialized yet');
  }
  return io;
};
