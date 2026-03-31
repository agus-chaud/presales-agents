// Sanitización de input de usuario antes de pasar al agent loop.
// Protege contra: prompt injection por input enorme, caracteres de control
// que podrían romper el JSON enviado al LLM.
const MAX_INPUT_LENGTH = 4000;

export function sanitizeInput(raw: string): string {
  return (
    raw
      .trim()
      // Limitar longitud para prevenir prompt injection masivo
      .slice(0, MAX_INPUT_LENGTH)
      // Eliminar caracteres de control no-imprimibles (excepto \n, \r, \t)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  );
}
