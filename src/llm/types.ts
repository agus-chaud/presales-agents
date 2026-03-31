// DECISIÓN DEC-002: Interfaz LLMProvider como frontera de abstracción.
// Ni el agent loop ni los handlers importan providers concretos.
// Cambiar de proveedor = implementar esta interfaz + registrar en ProviderManager.

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  // Requerido cuando role === 'tool'
  tool_call_id?: string;
  name?: string;
  // Requerido cuando role === 'assistant' y el LLM quiere llamar tools.
  // Sin este campo, el historial es inválido y el proveedor rechaza el siguiente request.
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LLMResponse {
  content: string | null;
  toolCalls?: ToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
}

// ESCALABILIDAD: Para añadir Anthropic, Gemini, Ollama, etc.
// basta con implementar esta interfaz y registrar el provider.
export interface LLMProvider {
  readonly name: string;
  chat(messages: Message[], tools: ToolDefinition[]): Promise<LLMResponse>;
}
