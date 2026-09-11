import { generateWithRetry, LLMError, type GenerateObjectRequest, type LLMProvider } from "./provider";

/** Adaptador para la API de OpenAI (Chat Completions con modo JSON). */
export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
  readonly model: string;
  private readonly apiKey: string;

  constructor(options: { model?: string } = {}) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new LLMError("Falta OPENAI_API_KEY en el entorno.", "openai");
    this.apiKey = key;
    this.model = options.model ?? process.env.OPENAI_MODEL ?? "gpt-5";
  }

  async generateObject<T>(request: GenerateObjectRequest<T>): Promise<T> {
    return generateWithRetry(this.name, request, async (system, prompt) => {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: request.temperature ?? 0.4,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      const data = (await response.json()) as { choices: { message: { content: string } }[] };
      return data.choices[0]?.message.content ?? "";
    });
  }
}
