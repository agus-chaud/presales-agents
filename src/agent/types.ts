import type { Message } from '../llm/types.js';
import type { IQ4bProfile } from '../db/repositories/companyProfileRepo.js';

export interface AgentInput {
  userId: number;
  userMessage: string;
  // Historial completo de conversación cargado desde la DB
  history: Message[];
  // Perfil de IQ4b para inyectar en el system prompt (opcional)
  iq4bProfile?: IQ4bProfile;
  // Override del system prompt completo — si se provee, ignora iq4bProfile para el prompt.
  // Usado por el agente de leads para un prompt especializado distinto al de análisis.
  systemPrompt?: string;
}

export interface AgentResult {
  finalAnswer: string;
  iterationsUsed: number;
  toolCallsMade: string[];   // nombres de tools llamadas, para logging
  abortedByLimit: boolean;   // true si se alcanzó MAX_ITERATIONS sin respuesta final
}

export interface AgentState {
  messages: Message[];       // lista de trabajo para el LLM (sistema + historial + user)
  iteration: number;
  toolCallsMade: string[];
}
