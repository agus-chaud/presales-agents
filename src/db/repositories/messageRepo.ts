// Repository de mensajes: historial de conversación por sesión.
import { getDb, isSqliteAvailable } from '../database.js';
import type { Message } from '../../llm/types.js';
import { env } from '../../config/env.js';
import { messageRepoFirestore } from '../firestore-repos.js';
import { logger } from '../../utils/logger.js';

export interface DbMessage {
  id: number | string;
  session_id: number | string;
  role: string;
  content: string;
  created_at: string;
}

interface NewMessage {
  sessionId: number | string;
  role: Message['role'];
  content: string;
}

export const messageRepo = {
  async insert(msg: NewMessage): Promise<void> {
    // 1. Persistencia Local (SQLite)
    if (isSqliteAvailable()) {
      try {
        getDb()
          .prepare(
            'INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)',
          )
          .run(Number(msg.sessionId), msg.role, msg.content);
      } catch (err) {
        logger.error('Error insertando mensaje en SQLite', { error: String(err) });
      }
    }

    // 2. Persistencia Cloud (Firestore)
    if (env.FIREBASE_PROJECT_ID) {
      try {
        await messageRepoFirestore.insert(msg as any);
      } catch (err) {
        logger.warn('Error sincronizando mensaje con Firestore', { error: String(err) });
      }
    }
  },

  async getBySession(sessionId: number | string, limit = 40): Promise<Message[]> {
    if (isSqliteAvailable()) {
      try {
        const rows = getDb()
          .prepare(
            `SELECT * FROM messages
             WHERE session_id = ?
             ORDER BY created_at DESC
             LIMIT ?`,
          )
          .all(Number(sessionId), limit) as DbMessage[];

        if (rows.length > 0) {
          return rows.reverse().map((r) => ({
            role: r.role as Message['role'],
            content: r.content,
          }));
        }
      } catch (err) {
        logger.debug('Error leyendo de SQLite getBySession', { sessionId });
      }
    }

    if (env.FIREBASE_PROJECT_ID) {
      return messageRepoFirestore.getBySession(sessionId as string, limit);
    }

    return [];
  },

  async clearSession(sessionId: number | string): Promise<void> {
    if (isSqliteAvailable()) {
      try {
        getDb()
          .prepare('DELETE FROM messages WHERE session_id = ?')
          .run(Number(sessionId));
      } catch (err) {
        logger.error('Error limpiando sesión en SQLite', { error: String(err) });
      }
    }

    if (env.FIREBASE_PROJECT_ID) {
      try {
        await messageRepoFirestore.clearSession(sessionId as string);
      } catch (err) {
        logger.warn('Error borrando sesión en Firestore', { error: String(err) });
      }
    }
  },
};
