// src/services/session-management.service.ts

/**
 * SessionManagementService: Handles chat session lifecycle management
 *
 * Responsibilities:
 * - Create new chat sessions with unique IDs
 * - Validate sessions (check for idle and absolute timeouts)
 * - Extend session activity timestamps
 * - Clean up expired sessions from database
 *
 * Default timeouts:
 * - Idle timeout: 30 minutes of inactivity
 * - Absolute timeout: 4 hours total session duration
 */

import { db } from '../db/index.js';
import { chatSessions } from '../models/schema.model.js';
import { eq, or, lt } from 'drizzle-orm';
import { Logger } from '../utils/logger.js';
import { AppError } from '../middleware/errorHandler.js';

export interface SessionConfig {
  idleTimeoutMs: number;
  absoluteTimeoutMs: number;
}

export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  idleTimeoutMs: 30 * 60 * 1000,
  absoluteTimeoutMs: 4 * 60 * 60 * 1000,
};

export interface SessionValidationResult {
  isValid: boolean;
  reason?: 'not_found' | 'idle_timeout' | 'absolute_timeout';
  session?: {
    id: number;
    sessionId: string;
    createdAt: Date | null;
    lastActivityAt: Date | null;
  };
}

export class SessionManagementService {
  private readonly logger = new Logger({ serviceName: 'SessionManagementService' });
  private readonly config: SessionConfig;

  constructor(config: SessionConfig = DEFAULT_SESSION_CONFIG) {
    this.config = config;
  }

  async isSessionValid(sessionId: string): Promise<SessionValidationResult> {
    const session = await db
      .select({
        id: chatSessions.id,
        sessionId: chatSessions.sessionId,
        createdAt: chatSessions.createdAt,
        lastActivityAt: chatSessions.lastActivityAt,
      })
      .from(chatSessions)
      .where(eq(chatSessions.sessionId, sessionId))
      .limit(1);

    if (!session || session.length === 0) {
      return { isValid: false, reason: 'not_found' };
    }

    const now = new Date();
    const s = session[0];
    const lastActivityAt = s.lastActivityAt ? new Date(s.lastActivityAt) : new Date(0);
    const createdAt = s.createdAt ? new Date(s.createdAt) : new Date(0);
    const idleTime = now.getTime() - lastActivityAt.getTime();
    const lifetime = now.getTime() - createdAt.getTime();

    if (idleTime >= this.config.idleTimeoutMs) {
      this.logger.info('Session expired due to inactivity', { sessionId });
      return { isValid: false, reason: 'idle_timeout', session: s };
    }
    if (lifetime >= this.config.absoluteTimeoutMs) {
      this.logger.info('Session expired due to absolute timeout', { sessionId });
      return { isValid: false, reason: 'absolute_timeout', session: s };
    }
    return { isValid: true, session: s };
  }

  async getOrCreateSession(sessionId: string): Promise<{ id: number; sessionId: string; isNew: boolean; }> {
    if (!sessionId || sessionId.trim() === '') {
      throw new AppError('Session ID must be provided', 400);
    }

    const validation = await this.isSessionValid(sessionId);
    if (validation.isValid && validation.session) {
      await this.extendSession(sessionId);
      return { id: validation.session.id, sessionId: validation.session.sessionId, isNew: false };
    }

    try {
      const result = await db
        .insert(chatSessions)
        .values({ sessionId: sessionId.trim() })
        .onConflictDoUpdate({
          target: chatSessions.sessionId,
          set: { lastActivityAt: new Date(), createdAt: new Date() },
        })
        .returning({ id: chatSessions.id, sessionId: chatSessions.sessionId });

      if (!result || result.length === 0) {
        throw new AppError('Failed to create session', 500);
      }
      this.logger.info('Session created or refreshed', { sessionId });
      return { id: result[0].id, sessionId: result[0].sessionId, isNew: true };
    } catch (error: unknown) {
      this.logger.error('Failed to create session', error as Error, { sessionId });
      throw new AppError('Failed to initialize chat session', 500);
    }
  }

  async extendSession(sessionId: string): Promise<void> {
    await db
      .update(chatSessions)
      .set({ lastActivityAt: new Date() })
      .where(eq(chatSessions.sessionId, sessionId));
  }

  async invalidateSession(sessionId: string): Promise<void> {
    await db.delete(chatSessions).where(eq(chatSessions.sessionId, sessionId));
    this.logger.info('Session invalidated', { sessionId });
  }

  async cleanupExpiredSessions(): Promise<{ deletedCount: number; idleCutoff: Date; absoluteCutoff: Date; }> {
    const now = new Date();
    const idleCutoff = new Date(now.getTime() - this.config.idleTimeoutMs);
    const absoluteCutoff = new Date(now.getTime() - this.config.absoluteTimeoutMs);

    const result = await db
      .delete(chatSessions)
      .where(
        or(
          lt(chatSessions.lastActivityAt, idleCutoff),
          lt(chatSessions.createdAt, absoluteCutoff)
        )
      )
      .returning({ id: chatSessions.id });

    this.logger.info('Session cleanup completed', { deletedCount: result.length });
    return { deletedCount: result.length, idleCutoff, absoluteCutoff };
  }
}


