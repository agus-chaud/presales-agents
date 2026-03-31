// Interfaces del sistema de herramientas del agente.
// DECISIÓN DEC-003: Tool Registry pattern — cada herramienta es un archivo
// independiente, el loop no sabe cuántas ni cuáles existen.

export interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface Tool {
  schema: ToolSchema;
  execute(args: Record<string, unknown>): Promise<ToolResult>;
}
