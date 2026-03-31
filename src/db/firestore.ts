import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import fs from 'node:fs';

let db: Firestore | null = null;

export function getFirestoreDb(): Firestore {
  if (!db) {
    throw new Error('Firestore no inicializado. Llamar initFirestore() primero.');
  }
  return db;
}

export function initFirestore(): void {
  try {
    let app: App;
    
    if (getApps().length === 0) {
      if (env.FIREBASE_SERVICE_ACCOUNT_JSON && fs.existsSync(env.FIREBASE_SERVICE_ACCOUNT_JSON)) {
        const serviceAccount = JSON.parse(fs.readFileSync(env.FIREBASE_SERVICE_ACCOUNT_JSON, 'utf8'));
        app = initializeApp({
          credential: cert(serviceAccount),
          projectId: env.FIREBASE_PROJECT_ID || serviceAccount.project_id
        });
        logger.info('Firebase inicializado con service account');
      } else {
        // Usa credenciales por defecto (Application Default Credentials o env var GOOGLE_APPLICATION_CREDENTIALS)
        app = initializeApp({
          projectId: env.FIREBASE_PROJECT_ID
        });
        logger.info('Firebase inicializado con credenciales por defecto (ADC)');
      }
    } else {
      app = getApps()[0]!;
    }

    db = getFirestore(app);
    // Configuraciones recomendadas para Firestore
    db.settings({ ignoreUndefinedProperties: true });
    
    logger.info('Firestore inicializado correctamente', { 
      projectId: env.FIREBASE_PROJECT_ID || 'default' 
    });
  } catch (error) {
    logger.error('Error al inicializar Firestore', { error: String(error) });
    throw error;
  }
}
