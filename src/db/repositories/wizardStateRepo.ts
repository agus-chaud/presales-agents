// Repository para persistir el estado del wizard de intake en Firestore.
// Garantiza que el wizard sobreviva reinicios del bot.
// Colección: wizard_states / documento: userId (como string)

import { getFirestoreDb } from '../firestore.js';
import { logger } from '../../utils/logger.js';

// Pasos del wizard de intake del prospecto
export type WizardStep =
  | 'idle'
  | 'awaiting_company'
  | 'awaiting_website'
  | 'awaiting_linkedin'
  | 'awaiting_topic'
  | 'awaiting_message'
  | 'ready';

// Pasos del wizard de configuración de perfil IQ4b
export type ProfileStep =
  | 'idle'
  | 'awaiting_nombre'
  | 'awaiting_descripcion'
  | 'awaiting_propuesta'
  | 'awaiting_clientes'
  | 'awaiting_casos'
  | 'awaiting_diferenciadores'
  | 'awaiting_servicios'
  | 'awaiting_herramientas'
  | 'awaiting_clientes_ref'
  | 'awaiting_senales'
  | 'done';

// Pasos del wizard de búsqueda de leads
export type LeadsStep = 'idle' | 'awaiting_context';

export interface WizardState {
  userId: number;
  // Wizard de intake del prospecto
  intakeStep: WizardStep;
  companyName?: string;
  website?: string;
  linkedin?: string;
  topic?: string;
  prospectMessage?: string;
  // Wizard de búsqueda de leads
  leadsStep?: LeadsStep;
  // Wizard de perfil IQ4b
  profileStep: ProfileStep;
  profileData?: {
    nombre?: string;
    descripcion?: string;
    propuesta_de_valor?: string;
    clientes_ideales?: string;
    casos_de_exito?: string;
    diferenciadores?: string;
    servicios?: string;
    herramientas_qlik?: string;
    clientes_referencia?: string;
    senales_de_compra?: string;
  };
  updated_at: string;
}

const COLLECTION = 'wizard_states';

const defaultState = (userId: number): WizardState => ({
  userId,
  intakeStep: 'idle',
  profileStep: 'idle',
  updated_at: new Date().toISOString(),
});

const FIRESTORE_TIMEOUT_MS = 5000;

export const wizardStateRepo = {
  async get(userId: number): Promise<WizardState> {
    try {
      const db = getFirestoreDb();
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Firestore read timeout')), FIRESTORE_TIMEOUT_MS),
      );
      const doc = await Promise.race([
        db.collection(COLLECTION).doc(String(userId)).get(),
        timeout,
      ]);
      if (!doc.exists) return defaultState(userId);
      return doc.data() as WizardState;
    } catch (err) {
      logger.warn('Error leyendo wizard state de Firestore, usando default', { error: String(err) });
      return defaultState(userId);
    }
  },

  async save(state: WizardState): Promise<void> {
    try {
      const db = getFirestoreDb();
      await db.collection(COLLECTION).doc(String(state.userId)).set({
        ...state,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      logger.error('Error guardando wizard state en Firestore', { error: String(err) });
    }
  },

  async reset(userId: number): Promise<void> {
    try {
      const db = getFirestoreDb();
      await db.collection(COLLECTION).doc(String(userId)).set(defaultState(userId));
    } catch (err) {
      logger.error('Error reseteando wizard state en Firestore', { error: String(err) });
    }
  },
};
