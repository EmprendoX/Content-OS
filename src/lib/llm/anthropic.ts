import { generateWithRetry, LLMError, type GenerateObjectRequest, type LLMProvider } from "./provider";

/**
 * Adaptador para la Claude API (Messages). Usa fetch directamente para no
 * añadir dependencias. La clave solo se lee del entorno.
 */
export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  readonly model: string;
  private readonly apiKey: string;

  constructor(options: { model?: string } = {}) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new LLMError("Falta ANTHROPIC_API_KEY en el entorno.", "anthropic");
    this.apiKey = key;
    this.model = options.model ?? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
  }

  async generateObject<T>(request: GenerateObjectRequest<T>): Promise<T> {
    return generateWithRetry(this.name, request, async (system, prompt) => {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 8192,
          temperature: request.temperature ?? 0.5,
          system,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      const data = (await response.json()) as { content: { type: string; text?: string }[] };
      return data.content
        .filter((block) => block.type === "text")
        .map((block) => block.text ?? "")
        .join("\n");
    });
  }
}
