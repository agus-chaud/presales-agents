// Repository de sesiones: una sesión por usuario (user_id UNIQUE).
import { getDb, isSqliteAvailable } from '../database.js';
import { env } from '../../config/env.js';
import { sessionRepoFirestore } from '../firestore-repos.js';
import { logger } from '../../utils/logger.js';

export interface Session {
  id: number | string;
  user_id: number;
  created_at: string;
  updated_at: string;
}

export const sessionRepo = {
  // Obtiene la sesión existente o crea una nueva para el usuario
  async getOrCreate(userId: number): Promise<Session> {
    let existing: Session | undefined;

    // 1. Obtener de SQLite (Local) si está disponible
    if (isSqliteAvailable()) {
      try {
        const db = getDb();
        existing = db
          .prepare('SELECT * FROM sessions WHERE user_id = ?')
          .get(userId) as Session | undefined;

        if (existing) {
          db.prepare(
            "UPDATE sessions SET updated_at = datetime('now') WHERE user_id = ?",
          ).run(userId);
        } else {
          db.prepare(
            'INSERT INTO sessions (user_id) VALUES (?)',
          ).run(userId);
          existing = db
            .prepare('SELECT * FROM sessions WHERE user_id = ?')
            .get(userId) as Session;
        }
      } catch (err) {
        logger.error('Error en SQLite sessionRepo.getOrCreate', { error: String(err) });
      }
    }

    // 2. Sincronizar con Firestore si está habilitado (Cloud)
    if (env.FIREBASE_PROJECT_ID) {
      try {
        const cloudSession = await sessionRepoFirestore.getOrCreate(userId);
        if (!existing) existing = cloudSession;
      } catch (err) {
        logger.warn('Error sincronizando sesión con Firestore', { error: String(err) });
      }
    }

    if (!existing) {
      throw new Error('No hay base de datos disponible (SQLite ni Firestore).');
    }

    return existing;
  },

  async getById(id: number | string): Promise<Session | undefined> {
    if (isSqliteAvailable()) {
      try {
        const local = getDb()
          .prepare('SELECT * FROM sessions WHERE id = ?')
          .get(Number(id)) as Session | undefined;
        if (local) return local;
      } catch (err) {
        logger.debug('Error leyendo de SQLite getById', { id });
      }
    }

    if (env.FIREBASE_PROJECT_ID) {
      return sessionRepoFirestore.getById(id as string);
    }
    
    return undefined;
  },
};
