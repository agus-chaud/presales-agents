import { logger } from '../utils/logger.js';

export function parseToolArguments(
  provider: string,
  toolName: string,
  rawArgs: string,
): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(rawArgs) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      logger.warn(`${provider}: tool arguments inválidos (no es objeto JSON)`, {
        toolName,
        args: rawArgs,
      });
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    logger.warn(`${provider}: no se pudo parsear tool arguments`, {
      toolName,
      args: rawArgs,
    });
    return null;
  }
}
