/**
 * Genera contenido real con el proveedor configurado en el entorno.
 *
 *   npm run generate -- --brand "RexSite" --topic "Tema" --networks linkedin,instagram,x [--campaign X] [--goal Y]
 *
 * Crea una pieza, ejecuta el pipeline completo e imprime pieza maestra,
 * adaptaciones y revisiones. El resultado queda pendiente de aprobación en la app.
 */
import { eq } from "drizzle-orm";
import { createDb } from "@/lib/db/client";
import { agentRuns, brands, contentVariants } from "@/lib/db/schema";
import { createLlmProvider } from "@/lib/llm";
import { createPiece, runPipeline } from "@/lib/agents/orchestrator";
import { isNetwork, type Network } from "@/lib/networks";
import type { LlmProviderName } from "@/lib/settings";
import type { MasterOutput, ReviewOutput } from "@/lib/agents/schemas";

function arg(name: string, fallback = ""): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function main() {
  const db = createDb();
  const brandName = arg("brand", "RexSite");
  const topic = arg("topic");
  if (!topic) throw new Error("Falta --topic");
  const networks = arg("networks", "linkedin,instagram").split(",").map((n) => n.trim()).filter(isNetwork) as Network[];
  const providerName = (process.env.LLM_PROVIDER ?? "mock") as LlmProviderName;

  const brand = db.select().from(brands).all().find((b) => b.name.toLowerCase() === brandName.toLowerCase());
  if (!brand) throw new Error(`Marca no encontrada: ${brandName}`);

  const provider = createLlmProvider(providerName);
  console.log(`Proveedor: ${provider.name} (${provider.model}). Marca: ${brand.name}. Redes: ${networks.join(", ")}.`);

  const piece = createPiece(db, { brandId: brand.id, topic, campaign: arg("campaign"), goal: arg("goal"), networks }, "humano:cli");
  const started = Date.now();
  const result = await runPipeline(piece.id, { db, provider, actorLabel: "orquestador" });
  console.log(`\nPipeline terminado en ${Math.round((Date.now() - started) / 1000)} s → ${result.status}\n`);

  const master = result.master as MasterOutput;
  console.log("=== PIEZA MAESTRA ===");
  console.log(`Título: ${master.title}\nHook: ${master.hook}\n\n${master.body}\n\nCTA: ${master.cta}\n`);

  for (const v of db.select().from(contentVariants).where(eq(contentVariants.pieceId, piece.id)).all()) {
    const review = v.review as ReviewOutput | null;
    console.log(`=== ${v.network.toUpperCase()} · ${v.format} · ${v.status} · revisión ${review?.score ?? "—"}/100 ===`);
    console.log(`Hook: ${v.hook}\n\n${v.copy}\n\nCTA: ${v.cta}\nHashtags: ${v.hashtags.join(" ")}`);
    if (review?.issues.length) console.log(`Problemas: ${review.issues.map((i) => `[${i.severity}] ${i.message}`).join(" | ")}`);
    if (v.reviewerComments) console.log(`Editor jefe: ${v.reviewerComments}`);
    console.log();
  }

  const runs = db.select().from(agentRuns).where(eq(agentRuns.pieceId, piece.id)).all();
  console.log(`Ejecuciones: ${runs.length} · tiempo total de agentes: ${Math.round(runs.reduce((a, r) => a + r.durationMs, 0) / 1000)} s`);
  console.log(`Pieza: http://127.0.0.1:3000/studio/${piece.id}`);
}

main().catch((error) => {
  console.error("ERROR:", error.message);
  process.exit(1);
});
