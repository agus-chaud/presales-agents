// Repository del perfil de IQ4b (empresa del usuario).
// Se guarda como documento único "global" en Firestore — compartido entre todos los usuarios del bot.
// Se pregunta UNA SOLA VEZ y se inyecta siempre como contexto del agente.

import { getFirestoreDb } from '../firestore.js';
import { logger } from '../../utils/logger.js';

export interface IQ4bProfile {
  nombre: string;
  descripcion: string;
  propuesta_de_valor: string;
  clientes_ideales: string;
  casos_de_exito: string;
  diferenciadores: string;
  // Campos extendidos de conocimiento
  servicios?: string;           // Servicios concretos que ofrece IQ4b
  herramientas_qlik?: string;   // Herramientas y módulos Qlik que manejan
  clientes_referencia?: string; // Clientes reales como social proof por industria
  senales_de_compra?: string;   // Señales de fit — puente para el agente de leads
  updated_at: string;
}

const COLLECTION = 'iq4b_profile';
const DOC_ID = 'global';

const FIRESTORE_TIMEOUT_MS = 5000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Firestore read timeout')), FIRESTORE_TIMEOUT_MS),
  );
  return Promise.race([promise, timeout]);
}

export const companyProfileRepo = {
  async get(): Promise<IQ4bProfile | null> {
    try {
      const db = getFirestoreDb();
      const doc = await withTimeout(db.collection(COLLECTION).doc(DOC_ID).get());
      if (!doc.exists) return null;
      return doc.data() as IQ4bProfile;
    } catch (err) {
      logger.error('Error leyendo perfil IQ4b de Firestore', { error: String(err) });
      return null;
    }
  },

  async save(profile: Omit<IQ4bProfile, 'updated_at'>): Promise<void> {
    try {
      const db = getFirestoreDb();
      await db.collection(COLLECTION).doc(DOC_ID).set({
        ...profile,
        updated_at: new Date().toISOString(),
      });
      logger.info('Perfil IQ4b guardado en Firestore');
    } catch (err) {
      logger.error('Error guardando perfil IQ4b en Firestore', { error: String(err) });
      throw err;
    }
  },

  async exists(): Promise<boolean> {
    try {
      const db = getFirestoreDb();
      const doc = await withTimeout(db.collection(COLLECTION).doc(DOC_ID).get());
      return doc.exists;
    } catch {
      return false;
    }
  },
};
