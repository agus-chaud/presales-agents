// Singleton de conexión SQLite.
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createRequire } from 'node:module';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import {
  CREATE_COMPANIES_TABLE,
  CREATE_INDEXES,
  CREATE_MESSAGES_TABLE,
  CREATE_SESSIONS_TABLE,
} from './schema.js';

const require = createRequire(import.meta.url);

let db: any | null = null;
let sqliteAvailable = false;

export function isSqliteAvailable(): boolean {
  return sqliteAvailable;
}

export function getDb(): any {
  if (!sqliteAvailable || !db) {
    throw new Error('SQLite no disponible o no inicializado.');
  }
  return db;
}

export function initDatabase(): void {
  try {
    // Import dinámico para atrapar errores de carga de binarios nativos
    const Database = require('better-sqlite3');
    
    // Crear directorio de datos si no existe
    mkdirSync(dirname(env.DB_PATH), { recursive: true });

    db = new Database(env.DB_PATH);

    // WAL mode: mejor rendimiento para writes concurrentes
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Ejecutar migraciones (CREATE TABLE IF NOT EXISTS = idempotente)
    db.exec(CREATE_SESSIONS_TABLE);
    db.exec(CREATE_MESSAGES_TABLE);
    db.exec(CREATE_COMPANIES_TABLE);
    CREATE_INDEXES.forEach((idx) => db!.exec(idx));

    sqliteAvailable = true;
    logger.info('Base de datos local (SQLite) inicializada', { path: env.DB_PATH });
  } catch (err) {
    sqliteAvailable = false;
    logger.warn('No se pudo inicializar SQLite (copia local). Usando solo Firestore si está disponible.', {
      error: String(err),
    });
  }
}
