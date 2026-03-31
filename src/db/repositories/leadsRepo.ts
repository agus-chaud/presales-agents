// Repository para leads descubiertos por el agente de prospección.
// Colección Firestore: leads / documentos por ID auto-generado.
// Separado de companies (prospectos ya contactados) — DECISIÓN DEC-013.

import { getFirestoreDb } from '../firestore.js';
import { logger } from '../../utils/logger.js';

export interface Lead {
  id?: string;
  name: string;
  website?: string;
  industry?: string;
  fit_score: number;         // 1-10
  fit_signals: string[];     // señales de compra detectadas en la web
  why_fit: string;           // justificación del score
  search_query: string;      // contexto de búsqueda que generó este lead
  status: 'new' | 'reviewed' | 'contacted' | 'rejected';
  created_at: string;
}

const COLLECTION = 'leads';

export const leadsRepo = {
  async save(lead: Omit<Lead, 'id' | 'created_at'>): Promise<string> {
    try {
      const db = getFirestoreDb();
      const doc = await db.collection(COLLECTION).add({
        ...lead,
        created_at: new Date().toISOString(),
      });
      logger.info('Lead guardado', { id: doc.id, name: lead.name, score: lead.fit_score });
      return doc.id;
    } catch (err) {
      logger.error('Error guardando lead en Firestore', { error: String(err) });
      throw err;
    }
  },

  async saveMany(leads: Omit<Lead, 'id' | 'created_at'>[]): Promise<string[]> {
    const ids: string[] = [];
    for (const lead of leads) {
      try {
        const id = await this.save(lead);
        ids.push(id);
      } catch {
        // Continuar aunque falle uno
      }
    }
    return ids;
  },

  async list(limit = 20): Promise<Lead[]> {
    try {
      const db = getFirestoreDb();
      const snapshot = await db
        .collection(COLLECTION)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Lead, 'id'>),
      }));
    } catch (err) {
      logger.error('Error listando leads de Firestore', { error: String(err) });
      return [];
    }
  },

  async updateStatus(id: string, status: Lead['status']): Promise<void> {
    try {
      const db = getFirestoreDb();
      await db.collection(COLLECTION).doc(id).update({ status });
    } catch (err) {
      logger.error('Error actualizando status del lead', { id, error: String(err) });
    }
  },
};
