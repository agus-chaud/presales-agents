// DECISIÓN DEC-007: OpenRouter es compatible con la API de OpenAI.
// Se usa el SDK de openai con baseURL override en lugar de un cliente propio.
import OpenAI from 'openai';
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

export class OpenRouterProvider implements LLMProvider {
  readonly name: string;
  private client: OpenAI;
  private model: string;

  constructor(model: string) {
    this.model = model;
    this.name = `openrouter:${model}`;
    this.client = new OpenAI({
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://presalesteam.local',
        'X-Title': 'PresalesTeam',
      },
    });
  }

  async chat(
    messages: Message[],
    tools: ToolDefinition[],
  ): Promise<LLMResponse> {
    logger.debug('OpenRouter: enviando request', {
      model: this.model,
      messages: messages.length,
      tools: tools.length,
    });

    const response = await this.client.chat.completions.create(
      {
        model: this.model,
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
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

    return parseOpenRouterResponse(response);
  }
}

function parseOpenRouterResponse(
  response: OpenAI.Chat.ChatCompletion,
): LLMResponse {
  const choice = response.choices[0];
  if (!choice) {
    return { content: null, finishReason: 'error' };
  }

  const finishReason = mapFinishReason(choice.finish_reason);
  const content = choice.message.content ?? null;

  const toolCalls = choice.message.tool_calls
    ?.map((tc) => {
      const parsedArgs = parseToolArguments('OpenRouter', tc.function.name, tc.function.arguments);
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

