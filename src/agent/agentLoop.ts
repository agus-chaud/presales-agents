// Agent loop: implementa el patrón ReAct (Reason + Act).
// El LLM razona → llama herramientas → observa resultados → repite hasta responder.
// SEGURIDAD: MAX_ITERATIONS previene loops infinitos y consumo descontrolado de tokens.
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { providerManager } from '../llm/providerManager.js';
import { toolRegistry } from '../tools/registry.js';
import { buildSystemPrompt } from './prompts.js';
import type { AgentInput, AgentResult, AgentState } from './types.js';
import type { Message } from '../llm/types.js';

export async function runAgentLoop(input: AgentInput): Promise<AgentResult> {
  const MAX_ITERATIONS = env.AGENT_MAX_ITERATIONS;

  const state: AgentState = {
    messages: buildInitialMessages(input),
    iteration: 0,
    toolCallsMade: [],
  };

  // Deduplicación: previene que el LLM llame la misma tool con los mismos args en loop
  const seenToolCalls = new Set<string>();

  logger.info('Agent loop iniciado', {
    userId: input.userId,
    maxIterations: MAX_ITERATIONS,
    historyMessages: input.history.length,
  });

  while (state.iteration < MAX_ITERATIONS) {
    state.iteration++;
    logger.debug(`Iteración ${state.iteration}/${MAX_ITERATIONS}`);

    const tools = toolRegistry.getDefinitions();

    let response;
    try {
      response = await providerManager.chat(state.messages, tools);
    } catch (err) {
      logger.error('Todos los providers LLM fallaron', { error: String(err) });
      return {
        finalAnswer:
          'Lo siento, el servicio de IA no está disponible en este momento. Intenta de nuevo en unos minutos.',
        iterationsUsed: state.iteration,
        toolCallsMade: state.toolCallsMade,
        abortedByLimit: false,
      };
    }

    // Caso 1: El LLM quiere llamar herramientas
    if (
      response.finishReason === 'tool_calls' &&
      response.toolCalls?.length
    ) {
      // Registrar el turno del assistant CON tool_calls.
      // La API requiere este campo para que los mensajes role:'tool' subsiguientes sean válidos.
      state.messages.push({
        role: 'assistant',
        content: response.content ?? '',
        tool_calls: response.toolCalls?.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        })),
      });

      // Ejecutar cada tool call en secuencia (no en paralelo, para estado predecible)
      for (const toolCall of response.toolCalls) {
        // Deduplicación: si esta tool ya fue llamada con los mismos args, inyectar resultado cacheado
        const callKey = `${toolCall.name}:${JSON.stringify(toolCall.arguments)}`;
        if (seenToolCalls.has(callKey)) {
          logger.warn(`Tool call duplicado detectado: ${toolCall.name} — inyectando resultado cacheado`, {
            callKey,
          });
          state.messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.name,
            content: JSON.stringify({ note: 'Ya ejecutado — datos disponibles arriba. Generá la respuesta final ahora.' }),
          });
          continue;
        }
        seenToolCalls.add(callKey);

        state.toolCallsMade.push(toolCall.name);
        logger.info(`Ejecutando tool: ${toolCall.name}`, {
          args: toolCall.arguments,
        });

        const result = await toolRegistry.execute(
          toolCall.name,
          toolCall.arguments,
        );

        // Añadir resultado de la tool como mensaje para que el LLM lo procese
        const toolResultContent = result.success
          ? JSON.stringify(result.data)
          : JSON.stringify({ error: result.error });

        state.messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolCall.name,
          content: toolResultContent,
        });
      }

      // Continuar el loop — el LLM verá los resultados y decidirá qué hacer
      continue;
    }

    // Caso 2: Respuesta final del LLM
    if (response.finishReason === 'stop' && response.content) {
      logger.info('Agent loop completado', {
        userId: input.userId,
        iterations: state.iteration,
        toolsCalled: state.toolCallsMade,
      });

      return {
        finalAnswer: response.content,
        iterationsUsed: state.iteration,
        toolCallsMade: state.toolCallsMade,
        abortedByLimit: false,
      };
    }

    // Caso 3: Finish reason inesperado (length, error)
    logger.warn('Finish reason inesperado, terminando loop', {
      reason: response.finishReason,
      iteration: state.iteration,
    });
    break;
  }

  // Límite de iteraciones alcanzado o break inesperado
  const partialAnswer = extractLastAssistantMessage(state.messages);
  const finalAnswer =
    partialAnswer ??
    'No pude completar el análisis. Enviá /analyze para intentar de nuevo.';

  logger.warn('Agent loop abortado', {
    userId: input.userId,
    iterations: state.iteration,
    abortedByLimit: state.iteration >= MAX_ITERATIONS,
  });

  return {
    finalAnswer,
    iterationsUsed: state.iteration,
    toolCallsMade: state.toolCallsMade,
    abortedByLimit: true,
  };
}

function buildInitialMessages(input: AgentInput): Message[] {
  const systemMsg: Message = {
    role: 'system',
    content: input.systemPrompt ?? buildSystemPrompt(input.iq4bProfile),
  };

  // Limitar historial a las últimas 20 interacciones para no exceder el context window
  const recentHistory = input.history.slice(-20);

  const userMsg: Message = {
    role: 'user',
    content: input.userMessage,
  };

  return [systemMsg, ...recentHistory, userMsg];
}


function extractLastAssistantMessage(messages: Message[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg && msg.role === 'assistant' && msg.content?.trim()) {
      return msg.content;
    }
  }
  return null;
}
