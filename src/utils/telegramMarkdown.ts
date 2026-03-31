// Escape defensivo para texto dinámico en parse_mode Markdown de Telegram.
// Evita errores de parseo y formato inyectado desde inputs de usuario/LLM.
const MARKDOWN_SPECIAL_CHARS = /([\\_*`\[])/g;

export function escapeTelegramMarkdown(text: string): string {
  return text.replace(MARKDOWN_SPECIAL_CHARS, '\\$1');
}
