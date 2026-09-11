"use server";

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { contentPieces, contentVariants } from "@/lib/db/schema";
import { nowIso } from "@/lib/ids";
import { getLlmProvider } from "@/lib/llm";
import { isNetwork, type Network } from "@/lib/networks";
import { audit } from "@/lib/security/audit";
import { createPiece, regenerateVariant, reviewVariant, runPipeline } from "@/lib/agents/orchestrator";
import { saveVariantVersion, transitionVariant } from "@/lib/workflow/transitions";
import { HUMAN_ACTOR, safeAction, str } from "./shared";

export async function createPieceAction(form: FormData) {
  return safeAction(async () => {
    const db = getDb();
    const brandId = str(form, "brandId");
    const topic = str(form, "topic");
    if (!brandId || !topic) throw new Error("Marca y tema son obligatorios.");
    const networks = form.getAll("networks").map(String).filter(isNetwork) as Network[];
    if (networks.length === 0) throw new Error("Selecciona al menos una red.");
    const piece = createPiece(db, { brandId, topic, campaign: str(form, "campaign"), goal: str(form, "goal"), networks }, HUMAN_ACTOR);
    if (form.get("run") === "on") {
      await runPipeline(piece.id, { db, provider: getLlmProvider(db), actorLabel: "orquestador" });
    }
    return { pieceId: piece.id };
  }, "Pieza creada.");
}

export async function runPipelineAction(pieceId: string) {
  return safeAction(async () => {
    const db = getDb();
    const result = await runPipeline(pieceId, { db, provider: getLlmProvider(db), actorLabel: "orquestador" });
    return { status: result.status };
  }, "Pipeline ejecutado.");
}

export async function regenerateVariantAction(variantId: string) {
  return safeAction(async () => {
    const db = getDb();
    const variant = db.select().from(contentVariants).where(eq(contentVariants.id, variantId)).get();
    if (!variant) throw new Error("Variante no encontrada.");
    // Un humano devuelve la variante a cambios antes de que el agente la regenere.
    if (variant.status === "READY_FOR_APPROVAL" || variant.status === "APPROVED" || variant.status === "SCHEDULED") {
      transitionVariant(db, variantId, "NEEDS_CHANGES", "human", HUMAN_ACTOR, {
        reviewerComments: "Regeneración solicitada por el revisor.",
      });
    }
    const result = await regenerateVariant(variantId, { db, provider: getLlmProvider(db), actorLabel: "orquestador" });
    return { status: result.status };
  }, "Variante regenerada.");
}

/** Edición humana de una variante: guarda versión anterior y puede reenviar a revisión. */
export async function updateVariantAction(form: FormData) {
  return safeAction(async () => {
    const db = getDb();
    const id = str(form, "id");
    const variant = db.select().from(contentVariants).where(eq(contentVariants.id, id)).get();
    if (!variant) throw new Error("Variante no encontrada.");
    if (variant.status === "PUBLISHED" || variant.status === "PUBLISHING") {
      throw new Error("No se puede editar contenido publicado o en publicación.");
    }
    saveVariantVersion(db, variant, str(form, "reason") || "Edición manual", HUMAN_ACTOR);
    const hashtags = str(form, "hashtags")
      .split(/[\s,]+/)
      .map((h) => h.trim())
      .filter(Boolean)
      .map((h) => (h.startsWith("#") ? h : `#${h}`));
    db.update(contentVariants)
      .set({
        format: str(form, "format") || variant.format,
        hook: str(form, "hook"),
        copy: str(form, "copy"),
        cta: str(form, "cta"),
        hashtags,
        reviewerComments: str(form, "reviewerComments"),
        visualAssetId: str(form, "visualAssetId") || null,
        version: variant.version + 1,
        updatedAt: nowIso(),
      })
      .where(eq(contentVariants.id, id))
      .run();
    audit(db, { actor: HUMAN_ACTOR, action: "variant.edit", entityType: "content_variant", entityId: id, details: { version: variant.version + 1 } });

    // Si estaba aprobada, la edición invalida la aprobación.
    if (variant.status === "APPROVED" || variant.status === "SCHEDULED") {
      transitionVariant(db, id, "NEEDS_CHANGES", "human", HUMAN_ACTOR, { reviewerComments: "Editada tras aprobación: requiere nueva aprobación." });
    }
    if (form.get("rereview") === "on") {
      const current = db.select().from(contentVariants).where(eq(contentVariants.id, id)).get()!;
      if (current.status === "READY_FOR_APPROVAL") {
        transitionVariant(db, id, "NEEDS_CHANGES", "human", HUMAN_ACTOR);
      }
      await reviewVariant(id, { db, provider: getLlmProvider(db), actorLabel: "orquestador" });
    }
    return { id };
  }, "Variante guardada (nueva versión).");
}

export async function markPieceReadyAction(pieceId: string) {
  return safeAction(async () => {
    const db = getDb();
    const piece = db.select().from(contentPieces).where(eq(contentPieces.id, pieceId)).get();
    if (!piece) throw new Error("Pieza no encontrada.");
    const variants = db.select().from(contentVariants).where(eq(contentVariants.pieceId, pieceId)).all();
    for (const v of variants) {
      if (v.status === "NEEDS_CHANGES") transitionVariant(db, v.id, "READY_FOR_APPROVAL", "human", HUMAN_ACTOR);
    }
    if (piece.status === "NEEDS_CHANGES") {
      db.update(contentPieces).set({ status: "READY_FOR_APPROVAL", updatedAt: nowIso() }).where(eq(contentPieces.id, pieceId)).run();
      audit(db, { actor: HUMAN_ACTOR, action: "piece.transition", entityType: "content_piece", entityId: pieceId, details: { from: "NEEDS_CHANGES", to: "READY_FOR_APPROVAL" } });
    }
  }, "Marcado como pendiente de aprobación.");
}
