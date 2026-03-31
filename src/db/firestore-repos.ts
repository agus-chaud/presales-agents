import { getFirestoreDb } from './firestore.js';
import type { Message } from '../llm/types.js';
import type { Session } from './repositories/sessionRepo.js';
import type { DbMessage } from './repositories/messageRepo.js';
import type { Company } from './repositories/companyRepo.js';
import { FieldValue } from 'firebase-admin/firestore';

export const sessionRepoFirestore = {
  async getOrCreate(userId: number): Promise<Session> {
    const db = getFirestoreDb();
    const sessionsRef = db.collection('sessions');
    const snapshot = await sessionsRef.where('user_id', '==', userId).limit(1).get();

    const now = new Date().toISOString();

    if (!snapshot.empty) {
      const doc = snapshot.docs[0]!;
      await doc.ref.update({ updated_at: now });
      return { id: doc.id as any, ...doc.data() } as Session;
    }

    const newSession = {
      user_id: userId,
      created_at: now,
      updated_at: now,
    };

    const docRef = await sessionsRef.add(newSession);
    return { id: docRef.id as any, ...newSession } as Session;
  },

  async getById(id: string): Promise<Session | undefined> {
    const db = getFirestoreDb();
    const doc = await db.collection('sessions').doc(id).get();
    if (!doc.exists) return undefined;
    return { id: doc.id as any, ...doc.data() } as Session;
  },
};

export const messageRepoFirestore = {
  async insert(msg: { sessionId: string | number; role: Message['role']; content: string }): Promise<void> {
    const db = getFirestoreDb();
    const sessionId = String(msg.sessionId);
    await db.collection('messages').add({
      session_id: sessionId,
      role: msg.role,
      content: msg.content,
      created_at: FieldValue.serverTimestamp(),
    });
  },

  async getBySession(sessionId: string | number, limit = 40): Promise<Message[]> {
    const db = getFirestoreDb();
    const normalizedSessionId = String(sessionId);
    const snapshot = await db.collection('messages')
      .where('session_id', '==', normalizedSessionId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .get();

    const messages = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        role: data.role as Message['role'],
        content: data.content,
      };
    });

    return messages.reverse();
  },

  async clearSession(sessionId: string | number): Promise<void> {
    const db = getFirestoreDb();
    const normalizedSessionId = String(sessionId);
    const snapshot = await db.collection('messages')
      .where('session_id', '==', normalizedSessionId)
      .get();
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
};

export const companyRepoFirestore = {
  async upsert(company: { sessionId: string | number; name: string }): Promise<Company> {
    const db = getFirestoreDb();
    const companiesRef = db.collection('companies');
    const normalizedSessionId = String(company.sessionId);
    const snapshot = await companiesRef
      .where('session_id', '==', normalizedSessionId)
      .where('name', '==', company.name)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const doc = snapshot.docs[0]!;
      return { id: doc.id as any, ...doc.data() } as Company;
    }

    const now = new Date().toISOString();
    const newCompany = {
      session_id: normalizedSessionId,
      name: company.name,
      status: 'pending',
      research_data: null,
      draft_message: null,
      priority_score: null,
      created_at: now,
      updated_at: now,
    };

    const docRef = await companiesRef.add(newCompany);
    return { id: docRef.id as any, ...newCompany } as Company;
  },

  async getBySession(sessionId: string | number): Promise<Company[]> {
    const db = getFirestoreDb();
    const normalizedSessionId = String(sessionId);
    const snapshot = await db.collection('companies')
      .where('session_id', '==', normalizedSessionId)
      .orderBy('priority_score', 'desc')
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id as any, ...doc.data() } as Company));
  },

  async updateResearch(
    id: string,
    data: { researchData?: string; draftMessage?: string; status: Company['status'] }
  ): Promise<void> {
    const db = getFirestoreDb();
    const update: any = {
      status: data.status,
      updated_at: new Date().toISOString(),
    };
    if (data.researchData !== undefined) update.research_data = data.researchData;
    if (data.draftMessage !== undefined) update.draft_message = data.draftMessage;

    await db.collection('companies').doc(id).update(update);
  },

  async updatePriority(id: string, score: number): Promise<void> {
    const db = getFirestoreDb();
    await db.collection('companies').doc(id).update({
      priority_score: score,
      updated_at: new Date().toISOString(),
    });
  },
};
