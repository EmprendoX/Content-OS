import { z } from "zod";
import { OpenAIProvider } from "@/lib/llm/openai";
async function main() {
  const p = new OpenAIProvider();
  const t = Date.now();
  const r = await p.generateObject({ task: "ping", system: "Responde solo JSON.", prompt: "Saluda en una frase en español con ok=true.", schema: z.object({ ok: z.boolean(), greeting: z.string() }), input: {} });
  console.log(JSON.stringify({ model: p.model, ms: Date.now() - t, ...r }));
}
main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
