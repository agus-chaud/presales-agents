import { getDb, isSqliteAvailable } from '../database.js';
import { logger } from '../../utils/logger.js';
import {
  type LeadSignalRecord,
  type LeadSignalStatus,
  type NewLeadSignalRecord,
} from '../../leads/signalsContract.js';

interface SaveManyResult {
  inserted: number;
  ignored: number;
}

type LeadSignalRow = Omit<LeadSignalRecord, 'topic_signals' | 'intent_signals'> & {
  topic_signals: string;
  intent_signals: string;
};

function mapLeadSignalRow(row: LeadSignalRow): LeadSignalRecord {
  return {
    ...row,
    topic_signals: JSON.parse(row.topic_signals) as string[],
    intent_signals: JSON.parse(row.intent_signals) as string[],
  };
}

// Fase 1 se enfoca en contrato + persistencia local con dedupe.
// El espejo Firestore se implementará junto con la ingesta (Fase 3) para evitar duplicar
// reglas de normalización y conflictos de identidad entre stores.
export const leadSignalsRepo = {
  async saveMany(signals: NewLeadSignalRecord[]): Promise<SaveManyResult> {
    if (!isSqliteAvailable()) {
      throw new Error('SQLite no disponible para guardar lead_signals.');
    }

    let inserted = 0;
    let ignored = 0;

    const stmt = getDb().prepare(`
      INSERT OR IGNORE INTO lead_signals (
        signal_key,
        post_url,
        author,
        company,
        text,
        signal_timestamp,
        date_bucket,
        engagement_likes,
        engagement_comments,
        engagement_reposts,
        topic_signals,
        intent_signals,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = getDb().transaction((items: NewLeadSignalRecord[]) => {
      for (const item of items) {
        const result = stmt.run(
          item.signal_key,
          item.post_url,
          item.author,
          item.company,
          item.text,
          item.signal_timestamp,
          item.date_bucket,
          item.engagement_likes,
          item.engagement_comments,
          item.engagement_reposts,
          JSON.stringify(item.topic_signals),
          JSON.stringify(item.intent_signals),
          item.status,
        );

        if (result.changes === 1) {
          inserted += 1;
        } else {
          ignored += 1;
        }
      }
    });

    try {
      tx(signals);
      return { inserted, ignored };
    } catch (err) {
      logger.error('Error guardando lead_signals en SQLite', { error: String(err) });
      throw err;
    }
  },

  async listRecent(limit = 20): Promise<LeadSignalRecord[]> {
    if (!isSqliteAvailable()) {
      return [];
    }

    try {
      const rows = getDb()
        .prepare(
          `SELECT *
           FROM lead_signals
           ORDER BY signal_timestamp DESC
           LIMIT ?`,
        )
        .all(limit) as LeadSignalRow[];

      return rows.map(mapLeadSignalRow);
    } catch (err) {
      logger.error('Error listando lead_signals recientes', { error: String(err) });
      return [];
    }
  },

  async updateStatus(id: number | string, status: LeadSignalStatus): Promise<void> {
    if (!isSqliteAvailable()) {
      throw new Error('SQLite no disponible para actualizar lead_signals.');
    }

    try {
      getDb()
        .prepare(
          `UPDATE lead_signals
           SET status = ?, updated_at = datetime('now')
           WHERE id = ?`,
        )
        .run(status, Number(id));
    } catch (err) {
      logger.error('Error actualizando status de lead_signal', { id, status, error: String(err) });
      throw err;
    }
  },
};
