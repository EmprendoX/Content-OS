/**
 * Regenera una adaptación aplicando los comentarios del revisor.
 *
 *   npm run regenerate -- --piece <id> --network x
 */
import { and, eq } from "drizzle-orm";
import { createDb } from "@/lib/db/client";
import { contentVariants } from "@/lib/db/schema";
import { createLlmProvider } from "@/lib/llm";
import { regenerateVariant } from "@/lib/agents/orchestrator";
import { isNetwork, type Network } from "@/lib/networks";
import { transitionVariant } from "@/lib/workflow/transitions";
import type { LlmProviderName } from "@/lib/settings";
import type { ReviewOutput } from "@/lib/agents/schemas";

function arg(name: string, fallback = ""): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function main() {
  const db = createDb();
  const pieceId = arg("piece");
  const network = arg("network");
  if (!pieceId || !isNetwork(network)) throw new Error("Uso: --piece <id> --network <red>");
  const variant = db
    .select()
    .from(contentVariants)
    .where(and(eq(contentVariants.pieceId, pieceId), eq(contentVariants.network, network as Network)))
    .get();
  if (!variant) throw new Error("Variante no encontrada.");
  const provider = createLlmProvider((process.env.LLM_PROVIDER ?? "mock") as LlmProviderName);
  console.log(`Regenerando ${network} (v${variant.version}, ${variant.status}) con ${provider.name}/${provider.model}.`);
  console.log(`Feedback aplicado:\n${variant.reviewerComments}\n`);
  // Igual que en la interfaz: una persona devuelve la variante a cambios antes de regenerar.
  if (["READY_FOR_APPROVAL", "APPROVED", "SCHEDULED"].includes(variant.status)) {
    transitionVariant(db, variant.id, "NEEDS_CHANGES", "human", "humano:cli", {
      reviewerComments: variant.reviewerComments || "Regeneración solicitada por el revisor.",
    });
  }
  const started = Date.now();
  const result = await regenerateVariant(variant.id, { db, provider, actorLabel: "orquestador" });
  const review = result.review as ReviewOutput | null;
  console.log(`Terminado en ${Math.round((Date.now() - started) / 1000)} s → v${result.version} · ${result.status} · revisión ${review?.score ?? "—"}/100\n`);
  console.log(`Hook: ${result.hook}\n\n${result.copy}\n\nCTA: ${result.cta}\nHashtags: ${result.hashtags.join(" ")}`);
  if (review?.issues.length) console.log(`\nProblemas: ${review.issues.map((i) => `[${i.severity}] ${i.message}`).join(" | ")}`);
  console.log(`\nEditor jefe: ${result.reviewerComments}`);
}

main().catch((error) => {
  console.error("ERROR:", error.message);
  process.exit(1);
});
