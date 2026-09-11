import { z, type ZodType } from "zod";

/**
 * Contrato desacoplado para proveedores de IA.
 * Todos los agentes piden un objeto validado con Zod: nunca texto libre.
 */
export interface GenerateObjectRequest<T> {
  /** Identificador estable de la tarea (p. ej. "research"). Lo usa MockProvider. */
  task: string;
  system: string;
  prompt: string;
  schema: ZodType<T>;
  /** Objeto de entrada tipado; se serializa dentro del prompt. */
  input: unknown;
  temperature?: number;
}

export interface LLMProvider {
  readonly name: string;
  readonly model: string;
  generateObject<T>(request: GenerateObjectRequest<T>): Promise<T>;
}

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "LLMError";
  }
}

/** Extrae el primer objeto JSON de una respuesta de texto (tolera fences). */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("La respuesta no contiene JSON.");
    return JSON.parse(candidate.slice(start, end + 1));
  }
}

/** Construye el prompt completo con esquema JSON y entrada serializada. */
export function buildJsonPrompt<T>(request: GenerateObjectRequest<T>): string {
  const jsonSchema = z.toJSONSchema(request.schema as ZodType, { unrepresentable: "any" });
  return [
    request.prompt,
    "",
    "## Entrada (JSON)",
    "```json",
    JSON.stringify(request.input, null, 2),
    "```",
    "",
    "## Formato de salida",
    "Responde ÚNICAMENTE con un objeto JSON válido que cumpla este esquema. Sin explicaciones ni texto adicional.",
    "```json",
    JSON.stringify(jsonSchema, null, 2),
    "```",
  ].join("\n");
}

/**
 * Llama al proveedor, parsea y valida. Si falla la validación, reintenta una
 * vez enviando los errores al modelo.
 */
export async function generateWithRetry<T>(
  providerName: string,
  request: GenerateObjectRequest<T>,
  callModel: (system: string, prompt: string) => Promise<string>,
): Promise<T> {
  const basePrompt = buildJsonPrompt(request);
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt =
      attempt === 0
        ? basePrompt
        : `${basePrompt}\n\n## Corrección\nTu respuesta anterior no cumplió el esquema:\n${String(lastError)}\nDevuelve un JSON corregido.`;
    let raw: string;
    try {
      raw = await callModel(request.system, prompt);
    } catch (error) {
      throw new LLMError(`Error llamando a ${providerName}: ${(error as Error).message}`, providerName, error);
    }
    try {
      const parsed = extractJson(raw);
      const result = request.schema.safeParse(parsed);
      if (result.success) return result.data;
      lastError = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    } catch (error) {
      lastError = (error as Error).message;
    }
  }

  throw new LLMError(
    `La salida de ${providerName} para la tarea "${request.task}" no cumple el esquema: ${String(lastError)}`,
    providerName,
    lastError,
  );
}
