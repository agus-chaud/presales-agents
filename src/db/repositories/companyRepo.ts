// Repository de empresas: datos de investigación, drafts y scores de prioridad.
import { getDb, isSqliteAvailable } from '../database.js';
import { env } from '../../config/env.js';
import { companyRepoFirestore } from '../firestore-repos.js';
import { logger } from '../../utils/logger.js';

export interface Company {
  id: number | string;
  session_id: number | string;
  name: string;
  research_data: string | null;
  draft_message: string | null;
  priority_score: number | null;
  status: 'pending' | 'researching' | 'done' | 'error';
  created_at: string;
  updated_at: string;
}

interface NewCompany {
  sessionId: number | string;
  name: string;
}

interface CompanyIdentityForCloudSync {
  sessionId: string;
  name: string;
}

function getCloudSyncIdentityByLocalId(id: number | string): CompanyIdentityForCloudSync | undefined {
  if (!isSqliteAvailable()) {
    return undefined;
  }

  const numericId = Number(id);
  if (!Number.isFinite(numericId)) {
    return undefined;
  }

  const row = getDb()
    .prepare('SELECT session_id, name FROM companies WHERE id = ?')
    .get(numericId) as { session_id: number | string; name: string } | undefined;

  if (!row) {
    return undefined;
  }

  return {
    sessionId: String(row.session_id),
    name: row.name,
  };
}

export const companyRepo = {
  async upsert(company: NewCompany): Promise<Company> {
    let result: Company | undefined;

    // 1. Local
    if (isSqliteAvailable()) {
      try {
        const db = getDb();
        const existingLocal = db
          .prepare('SELECT * FROM companies WHERE session_id = ? AND name = ?')
          .get(Number(company.sessionId), company.name) as Company | undefined;

        if (existingLocal) {
          result = existingLocal;
        } else {
          db.prepare(
            'INSERT INTO companies (session_id, name) VALUES (?, ?)',
          ).run(Number(company.sessionId), company.name);

          result = db
            .prepare('SELECT * FROM companies WHERE session_id = ? AND name = ?')
            .get(Number(company.sessionId), company.name) as Company;
        }
      } catch (err) {
        logger.error('Error upserting empresa en SQLite', { error: String(err) });
      }
    }

    // 2. Cloud Sync
    if (env.FIREBASE_PROJECT_ID) {
      try {
        const cloudCompany = await companyRepoFirestore.upsert(company as any);
        if (!result) result = cloudCompany;
      } catch (err) {
        logger.warn('Error sincronizando empresa en Firestore', { error: String(err) });
      }
    }

    if (!result) {
      throw new Error('No hay base de datos disponible para upsert de empresa.');
    }

    return result;
  },

  async getBySession(sessionId: number | string): Promise<Company[]> {
    if (isSqliteAvailable()) {
      try {
        const rows = getDb()
          .prepare(
            `SELECT * FROM companies
             WHERE session_id = ?
             ORDER BY priority_score DESC NULLS LAST, created_at ASC`,
          )
          .all(Number(sessionId)) as Company[];
        
        if (rows.length > 0) return rows;
      } catch (err) {
        logger.debug('Error leyendo de SQLite getBySession', { sessionId });
      }
    }

    if (env.FIREBASE_PROJECT_ID) {
      return companyRepoFirestore.getBySession(sessionId as string);
    }

    return [];
  },

  async updateResearch(
    id: number | string,
    data: { researchData?: string; draftMessage?: string; status: Company['status'] },
  ): Promise<void> {
    if (isSqliteAvailable()) {
      try {
        getDb()
          .prepare(
            `UPDATE companies
             SET research_data = COALESCE(?, research_data),
                 draft_message = COALESCE(?, draft_message),
                 status = ?,
                 updated_at = datetime('now')
             WHERE id = ?`,
          )
          .run(
            data.researchData ?? null,
            data.draftMessage ?? null,
            data.status,
            Number(id),
          );
      } catch (err) {
        logger.error('Error actualizando investigación en SQLite', { error: String(err) });
      }
    }

    if (env.FIREBASE_PROJECT_ID) {
      try {
        const cloudId = String(id);
        await companyRepoFirestore.updateResearch(cloudId, data);
      } catch (err) {
        try {
          const identity = getCloudSyncIdentityByLocalId(id);
          if (identity) {
            const cloudCompany = await companyRepoFirestore.upsert(identity);
            await companyRepoFirestore.updateResearch(String(cloudCompany.id), data);
          } else {
            throw err;
          }
        } catch (cloudErr) {
          logger.warn('Error actualizando investigación en Firestore', { error: String(cloudErr) });
        }
      }
    }
  },

  async updatePriority(id: number | string, score: number): Promise<void> {
    if (isSqliteAvailable()) {
      try {
        getDb()
          .prepare(
            "UPDATE companies SET priority_score = ?, updated_at = datetime('now') WHERE id = ?",
          )
          .run(score, Number(id));
      } catch (err) {
        logger.error('Error actualizando prioridad en SQLite', { error: String(err) });
      }
    }

    if (env.FIREBASE_PROJECT_ID) {
      try {
        const cloudId = String(id);
        await companyRepoFirestore.updatePriority(cloudId, score);
      } catch (err) {
        try {
          const identity = getCloudSyncIdentityByLocalId(id);
          if (identity) {
            const cloudCompany = await companyRepoFirestore.upsert(identity);
            await companyRepoFirestore.updatePriority(String(cloudCompany.id), score);
          } else {
            throw err;
          }
        } catch (cloudErr) {
          logger.warn('Error actualizando prioridad en Firestore', { error: String(cloudErr) });
        }
      }
    }
  },
};
