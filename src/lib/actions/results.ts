"use server";

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { brands, contentPieces, contentVariants } from "@/lib/db/schema";
import { getLlmProvider } from "@/lib/llm";
import { runAnalytics } from "@/lib/agents/orchestrator";
import { toBrandContext } from "@/lib/agents/context";
import { collectMetrics } from "@/lib/social/publisher";
import { listResults } from "@/lib/queries";
import { safeAction } from "./shared";
import type { AnalyticsOutput } from "@/lib/agents/schemas";

export async function collectMetricsAction(variantId: string) {
  return safeAction(async () => {
    await collectMetrics(getDb(), variantId, "humano");
  }, "Métricas actualizadas (simuladas).");
}

export async function collectAllMetricsAction() {
  return safeAction(async () => {
    const db = getDb();
    const published = db.select().from(contentVariants).where(eq(contentVariants.status, "PUBLISHED")).all();
    let count = 0;
    for (const v of published) {
      if (!v.publishedUrl) continue;
      await collectMetrics(db, v.id, "humano");
      count += 1;
    }
    return { count };
  }, "Métricas recogidas para todo el contenido publicado.");
}

export async function runAnalyticsAction(brandId: string) {
  return safeAction<AnalyticsOutput>(async () => {
    const db = getDb();
    const brand = db.select().from(brands).where(eq(brands.id, brandId)).get();
    if (!brand) throw new Error("Marca no encontrada.");
    const rows = listResults(brandId).filter((r) => r.metrics);
    const metricsInput = rows.map((r) => {
      const piece = db.select().from(contentPieces).where(eq(contentPieces.id, r.pieceId)).get();
      return {
        variantId: r.variantId,
        network: r.network,
        topic: piece?.topic ?? r.topic,
        format: r.format,
        impressions: r.metrics!.impressions,
        reach: r.metrics!.reach,
        likes: r.metrics!.likes,
        comments: r.metrics!.comments,
        shares: r.metrics!.shares,
        saves: r.metrics!.saves,
        clicks: r.metrics!.clicks,
      };
    });
    return runAnalytics(
      { brand: toBrandContext(brand), metrics: metricsInput },
      { db, provider: getLlmProvider(db), actorLabel: "orquestador" },
    );
  }, "Análisis generado.");
}
