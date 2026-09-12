import { generateWithRetry, LLMError, type GenerateObjectRequest, type LLMProvider } from "./provider";

/**
 * Adaptador para la API de OpenAI (Chat Completions con modo JSON).
 * Los modelos de razonamiento (gpt-5*, o*) no aceptan `temperature` ni
 * `max_tokens`; se usa `max_completion_tokens` y se omite la temperatura.
 */
export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options: { model?: string } = {}) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new LLMError("Falta OPENAI_API_KEY en el entorno.", "openai");
    this.apiKey = key;
    this.model = options.model ?? process.env.OPENAI_MODEL ?? "gpt-5";
    this.baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  }

  private get isReasoningModel(): boolean {
    return /^(gpt-5|o\d)/i.test(this.model);
  }

  async generateObject<T>(request: GenerateObjectRequest<T>): Promise<T> {
    return generateWithRetry(this.name, request, async (system, prompt) => {
      const body: Record<string, unknown> = {
        model: this.model,
        response_format: { type: "json_object" },
        max_completion_tokens: 8192,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      };
      if (this.isReasoningModel) {
        // Para redacción, un esfuerzo de razonamiento bajo es suficiente y mucho más rápido.
        body.reasoning_effort = request.effort ?? process.env.OPENAI_REASONING_EFFORT ?? "low";
      } else {
        body.temperature = request.temperature ?? 0.5;
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      const data = (await response.json()) as {
        choices: { message: { content: string | null }; finish_reason?: string }[];
      };
      const choice = data.choices[0];
      if (!choice?.message.content) {
        throw new Error(`Respuesta vacía de OpenAI (finish_reason: ${choice?.finish_reason ?? "desconocido"}).`);
      }
      return choice.message.content;
    });
  }
}
