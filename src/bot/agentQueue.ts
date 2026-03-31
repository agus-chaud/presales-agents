// Queue por usuario: garantiza que nunca corran dos agentLoops en paralelo
// para el mismo usuario. Si llega un segundo request mientras hay uno activo,
// espera a que termine antes de arrancar.
//
// Patrón: promise-chain queue. El Map guarda el "tail" (último Promise encadenado).
// Cada nuevo task se encola como .then() del tail anterior.
// El tail almacenado NUNCA rechaza (siempre void) para no romper cadenas futuras.

import { logger } from '../utils/logger.js';

const queues = new Map<number, Promise<unknown>>();

/**
 * Encola un task para un usuario. Si ya hay un task activo, espera a que termine.
 * Retorna el resultado del task con tipo correcto.
 */
export function enqueueAgent<T>(userId: number, task: () => Promise<T>): Promise<T> {
  const tail = queues.get(userId) ?? Promise.resolve();
  const isQueued = queues.has(userId);

  if (isQueued) {
    logger.info('AgentQueue: request encolado, esperando turno', { userId });
  }

  // next ejecuta el task cuando tail resuelve (o rechaza — siempre lo corre)
  const next: Promise<T> = tail.then(() => task(), () => task());

  // Guardamos next.catch() como nuevo tail: nunca rechaza, preserva la cadena
  const nextTail = next.catch(() => {});
  queues.set(userId, nextTail);

  // Limpieza automática cuando este task es el último
  void next.finally(() => {
    // Sólo limpiar si este task sigue siendo el tail actual.
    // Si alguien se encoló después, no tocamos la cola.
    if (queues.get(userId) === nextTail) {
      queues.delete(userId);
    }
  });

  return next;
}

/** Retorna true si hay un agentLoop activo para ese usuario. */
export function isAgentBusy(userId: number): boolean {
  return queues.has(userId);
}
