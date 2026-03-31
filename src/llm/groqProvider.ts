// DECISIÓN DEC-008: Usar groq-sdk oficial en vez de fetch directo.
// Da tipos completos y manejo automático de errores de la API.
import Groq from 'groq-sdk';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { parseToolArguments } from './parseToolArguments.js';
import type {
  LLMProvider,
  LLMResponse,
  Message,
  ToolCall,
  ToolDefinition,
} from './types.js';

export class GroqProvider implements LLMProvider {
  readonly name: string;
  private client: Groq;
  private model: string;

  constructor(model: string) {
    this.model = model;
    this.name = `groq:${model}`;
    this.client = new Groq({ apiKey: env.GROQ_API_KEY });
  }

  async chat(
    messages: Message[],
    tools: ToolDefinition[],
  ): Promise<LLMResponse> {
    logger.debug('Groq: enviando request', {
      model: this.model,
      messages: messages.length,
      tools: tools.length,
    });

    const response = await this.client.chat.completions.create(
      {
        model: this.model,
        messages: messages as Groq.Chat.ChatCompletionMessageParam[],
        max_tokens: 2000,
        tools:
          tools.length > 0
            ? tools.map((t) => ({
                type: 'function' as const,
                function: {
                  name: t.name,
                  description: t.description,
                  parameters: t.parameters,
                },
              }))
            : undefined,
        tool_choice: tools.length > 0 ? 'auto' : undefined,
      },
      { signal: AbortSignal.timeout(60_000) },
    );

    return parseGroqResponse(response);
  }
}

function parseGroqResponse(
  response: Groq.Chat.ChatCompletion,
): LLMResponse {
  const choice = response.choices[0];
  if (!choice) {
    return { content: null, finishReason: 'error' };
  }

  const finishReason = mapFinishReason(choice.finish_reason);
  const content = choice.message.content ?? null;

  const toolCalls = choice.message.tool_calls
    ?.map((tc) => {
      const parsedArgs = parseToolArguments('Groq', tc.function.name, tc.function.arguments);
      if (!parsedArgs) {
        return null;
      }
      return {
        id: tc.id,
        name: tc.function.name,
        arguments: parsedArgs,
      } satisfies ToolCall;
    })
    .filter((tc): tc is ToolCall => tc !== null);

  return { content, toolCalls: toolCalls?.length ? toolCalls : undefined, finishReason };
}

function mapFinishReason(
  reason: string | null,
): LLMResponse['finishReason'] {
  switch (reason) {
    case 'stop':
      return 'stop';
    case 'tool_calls':
      return 'tool_calls';
    case 'length':
      return 'length';
    default:
      return 'error';
  }
}

