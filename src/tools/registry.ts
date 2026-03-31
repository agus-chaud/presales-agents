// ToolRegistry: mapa nombre → Tool.
// El agent loop llama getDefinitions() para obtener los schemas (enviados al LLM)
// y execute() para correr la herramienta elegida por el LLM.
// Errores en execute() NUNCA crashean el loop — se retornan como ToolResult.
import { logger } from '../utils/logger.js';
import type { Tool, ToolResult } from './types.js';
import type { ToolDefinition } from '../llm/types.js';

class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    if (this.tools.has(tool.schema.name)) {
      throw new Error(`Tool "${tool.schema.name}" ya está registrada`);
    }
    this.tools.set(tool.schema.name, tool);
    logger.info(`Tool registrada: ${tool.schema.name}`);
  }

  // Retorna los schemas en formato JSON Schema para el LLM
  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.schema.name,
      description: t.schema.description,
      parameters: t.schema.parameters,
    }));
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      logger.warn(`Tool desconocida solicitada: "${name}"`);
      return { success: false, error: `Herramienta desconocida: ${name}` };
    }

    try {
      const result = await tool.execute(args);
      logger.debug(`Tool "${name}" ejecutada`, {
        success: result.success,
        args,
      });
      return result;
    } catch (err) {
      logger.error(`Tool "${name}" lanzó excepción`, { error: String(err) });
      return {
        success: false,
        error: `Error en herramienta "${name}": ${String(err)}`,
      };
    }
  }

  listNames(): string[] {
    return Array.from(this.tools.keys());
  }
}

// Singleton — registrar tools en index.ts
export const toolRegistry = new ToolRegistry();
