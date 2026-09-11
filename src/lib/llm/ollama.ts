import { generateWithRetry, type GenerateObjectRequest, type LLMProvider } from "./provider";

/** Adaptador para Ollama local (API /api/chat con formato JSON). */
export class OllamaProvider implements LLMProvider {
  readonly name = "ollama";
  readonly model: string;
  private readonly baseUrl: string;

  constructor(options: { model?: string; baseUrl?: string } = {}) {
    this.baseUrl = (options.baseUrl ?? process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(/\/$/, "");
    this.model = options.model ?? process.env.OLLAMA_MODEL ?? "llama3.1";
  }

  async generateObject<T>(request: GenerateObjectRequest<T>): Promise<T> {
    return generateWithRetry(this.name, request, async (system, prompt) => {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          stream: false,
          format: "json",
          options: { temperature: request.temperature ?? 0.4 },
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      const data = (await response.json()) as { message: { content: string } };
      return data.message.content;
    });
  }
}
