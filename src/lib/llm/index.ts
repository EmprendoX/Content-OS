import type { Db } from "@/lib/db/client";
import { getLlmModel, getLlmProviderName, type LlmProviderName } from "@/lib/settings";
import { AnthropicProvider } from "./anthropic";
import { MockProvider } from "./mock";
import { OllamaProvider } from "./ollama";
import { OpenAIProvider } from "./openai";
import type { LLMProvider } from "./provider";

export type { LLMProvider, GenerateObjectRequest } from "./provider";
export { LLMError } from "./provider";
export { MockProvider } from "./mock";

export function createLlmProvider(name: LlmProviderName, model?: string): LLMProvider {
  switch (name) {
    case "anthropic":
      return new AnthropicProvider({ model });
    case "openai":
      return new OpenAIProvider({ model });
    case "ollama":
      return new OllamaProvider({ model });
    case "mock":
    default:
      return new MockProvider();
  }
}

/** Resuelve el proveedor configurado en Configuración (o en el entorno). */
export function getLlmProvider(db: Db): LLMProvider {
  return createLlmProvider(getLlmProviderName(db), getLlmModel(db));
}

export const LLM_PROVIDER_OPTIONS: { value: LlmProviderName; label: string; hint: string }[] = [
  { value: "mock", label: "MockProvider (desarrollo)", hint: "Sin API. Salidas deterministas para probar el flujo." },
  { value: "anthropic", label: "Anthropic (Claude API)", hint: "Requiere ANTHROPIC_API_KEY en el entorno." },
  { value: "openai", label: "OpenAI API", hint: "Requiere OPENAI_API_KEY en el entorno." },
  { value: "ollama", label: "Ollama local", hint: "Requiere Ollama corriendo en OLLAMA_BASE_URL." },
];
