// Wizard manager: combina caché en memoria con persistencia en Firestore.
// El caché en memoria evita viajes a Firestore en cada mensaje del mismo usuario.
// La persistencia en Firestore garantiza que el wizard sobreviva reinicios del bot.

import { wizardStateRepo } from '../db/repositories/wizardStateRepo.js';
import type { WizardState } from '../db/repositories/wizardStateRepo.js';

// Caché en memoria para acceso rápido
const cache = new Map<number, WizardState>();

export const wizardManager = {
  /**
   * Lee el estado del wizard para un usuario.
   * Prioriza caché en memoria; si no existe, carga desde Firestore.
   */
  async get(userId: number): Promise<WizardState> {
    if (cache.has(userId)) {
      return cache.get(userId)!;
    }
    const state = await wizardStateRepo.get(userId);
    cache.set(userId, state);
    return state;
  },

  /**
   * Actualiza el estado y sincroniza con Firestore.
   */
  async update(userId: number, patch: Partial<WizardState>): Promise<WizardState> {
    const current = await this.get(userId);
    const updated: WizardState = {
      ...current,
      ...patch,
      userId,
      updated_at: new Date().toISOString(),
    };
    cache.set(userId, updated);
    // Persistir en Firestore en background (no bloquea la respuesta al usuario)
    void wizardStateRepo.save(updated);
    return updated;
  },

  /**
   * Resetea el wizard de intake (no toca el perfil).
   */
  async resetIntake(userId: number): Promise<WizardState> {
    return this.update(userId, {
      intakeStep: 'idle',
      companyName: undefined,
      website: undefined,
      linkedin: undefined,
      topic: undefined,
      prospectMessage: undefined,
    });
  },

  /**
   * Resetea el wizard de configuración de perfil IQ4b.
   */
  async resetProfile(userId: number): Promise<WizardState> {
    return this.update(userId, {
      profileStep: 'idle',
      profileData: undefined,
    });
  },

  /**
   * Resetea el wizard de búsqueda de leads.
   */
  async resetLeads(userId: number): Promise<WizardState> {
    return this.update(userId, { leadsStep: 'idle' });
  },
};

// Re-exportar tipos para conveniencia
export type { WizardState, WizardStep, ProfileStep, LeadsStep } from '../db/repositories/wizardStateRepo.js';
