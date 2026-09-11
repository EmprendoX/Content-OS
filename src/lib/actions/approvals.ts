"use server";

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { contentPieces, contentVariants } from "@/lib/db/schema";
import { nowIso } from "@/lib/ids";
import { audit } from "@/lib/security/audit";
import { publishVariant, runDuePublications } from "@/lib/social/publisher";
import { transitionVariant, saveVariantVersion } from "@/lib/workflow/transitions";
import { HUMAN_ACTOR, safeAction } from "./shared";

/** Aprobación humana explícita, individual o por lote. */
export async function approveVariantsAction(variantIds: string[]) {
  return safeAction(async () => {
    const db = getDb();
    const approved: string[] = [];
    const skipped: string[] = [];
    for (const id of variantIds) {
      const variant = db.select().from(contentVariants).where(eq(contentVariants.id, id)).get();
      if (!variant) continue;
      if (variant.status !== "READY_FOR_APPROVAL" && variant.status !== "NEEDS_CHANGES" && variant.status !== "FAILED") {
        skipped.push(id);
        continue;
      }
      // NEEDS_CHANGES → READY_FOR_APPROVAL → APPROVED (ambas por humano)
      if (variant.status === "NEEDS_CHANGES") transitionVariant(db, id, "READY_FOR_APPROVAL", "human", HUMAN_ACTOR);
      transitionVariant(db, id, "APPROVED", "human", HUMAN_ACTOR, { approvedAt: nowIso() });
      approved.push(id);
      syncPieceStatus(id);
    }
    return { approved: approved.length, skipped: skipped.length };
  }, variantIds.length > 1 ? "Aprobación por lote aplicada." : "Contenido aprobado.");
}

export async function rejectVariantAction(variantId: string, comments: string) {
  return safeAction(async () => {
    const db = getDb();
    const variant = db.select().from(contentVariants).where(eq(contentVariants.id, variantId)).get();
    if (!variant) throw new Error("Variante no encontrada.");
    transitionVariant(db, variantId, "NEEDS_CHANGES", "human", HUMAN_ACTOR, { reviewerComments: comments });
    syncPieceStatus(variantId);
  }, "Devuelto a cambios.");
}

export async function scheduleVariantAction(variantId: string, scheduledAt: string | null) {
  return safeAction(async () => {
    const db = getDb();
    const variant = db.select().from(contentVariants).where(eq(contentVariants.id, variantId)).get();
    if (!variant) throw new Error("Variante no encontrada.");
    if (scheduledAt) {
      const date = new Date(scheduledAt);
      if (Number.isNaN(date.getTime())) throw new Error("Fecha no válida.");
      if (variant.status === "APPROVED") {
        transitionVariant(db, variantId, "SCHEDULED", "human", HUMAN_ACTOR, { scheduledAt: date.toISOString() });
      } else if (variant.status === "SCHEDULED") {
        db.update(contentVariants).set({ scheduledAt: date.toISOString(), updatedAt: nowIso() }).where(eq(contentVariants.id, variantId)).run();
        audit(db, { actor: HUMAN_ACTOR, action: "variant.reschedule", entityType: "content_variant", entityId: variantId, details: { scheduledAt } });
      } else {
        throw new Error("Solo se puede programar contenido aprobado.");
      }
    } else if (variant.status === "SCHEDULED") {
      transitionVariant(db, variantId, "APPROVED", "human", HUMAN_ACTOR, { scheduledAt: null });
    }
  }, scheduledAt ? "Programado." : "Programación retirada.");
}

const EDITABLE_FIELDS = ["hook", "copy", "cta", "format", "reviewerComments", "campaign"] as const;
type EditableField = (typeof EDITABLE_FIELDS)[number];

/** Edición directa desde la hoja (una celda). */
export async function updateCellAction(variantId: string, field: string, value: string) {
  return safeAction(async () => {
    if (!EDITABLE_FIELDS.includes(field as EditableField)) throw new Error("Campo no editable.");
    const db = getDb();
    const variant = db.select().from(contentVariants).where(eq(contentVariants.id, variantId)).get();
    if (!variant) throw new Error("Variante no encontrada.");
    if (variant.status === "PUBLISHED" || variant.status === "PUBLISHING") throw new Error("Contenido publicado: no editable.");

    if (field === "campaign") {
      db.update(contentPieces).set({ campaign: value, updatedAt: nowIso() }).where(eq(contentPieces.id, variant.pieceId)).run();
      return;
    }
    if (field !== "reviewerComments") saveVariantVersion(db, variant, `Edición en hoja: ${field}`, HUMAN_ACTOR);
    db.update(contentVariants)
      .set({
        [field]: value,
        ...(field !== "reviewerComments" ? { version: variant.version + 1 } : {}),
        updatedAt: nowIso(),
      })
      .where(eq(contentVariants.id, variantId))
      .run();
    audit(db, { actor: HUMAN_ACTOR, action: "variant.edit_cell", entityType: "content_variant", entityId: variantId, details: { field } });
    // Editar contenido aprobado invalida la aprobación.
    if (field !== "reviewerComments" && (variant.status === "APPROVED" || variant.status === "SCHEDULED")) {
      transitionVariant(db, variantId, "NEEDS_CHANGES", "human", HUMAN_ACTOR, { reviewerComments: "Editado tras aprobación: requiere nueva aprobación." });
    }
  });
}

/** Publicación inmediata con confirmación explícita del usuario. */
export async function publishNowAction(variantId: string, confirmed: boolean, dryRun?: boolean) {
  return safeAction(async () => {
    const db = getDb();
    const outcome = await publishVariant(db, variantId, { actor: HUMAN_ACTOR, confirmed, dryRun });
    if (outcome.job.status === "fallido") throw new Error(`Publicación fallida: ${outcome.job.error}`);
    return { status: outcome.variant.status, dryRun: outcome.job.dryRun, url: outcome.variant.publishedUrl };
  });
}

export async function runDueAction() {
  return safeAction(async () => {
    const outcomes = await runDuePublications(getDb());
    return { processed: outcomes.length, ok: outcomes.filter((o) => o.ok).length };
  }, "Programadas procesadas.");
}

export async function retryFailedAction(variantId: string) {
  return safeAction(async () => {
    const db = getDb();
    // FAILED → APPROVED exige actor humano; luego el usuario vuelve a publicar.
    transitionVariant(db, variantId, "APPROVED", "human", HUMAN_ACTOR);
  }, "Devuelto a aprobado. Puedes volver a publicar.");
}

/** Mantiene el estado de la pieza coherente con sus variantes (solo informativo). */
function syncPieceStatus(variantId: string) {
  const db = getDb();
  const variant = db.select().from(contentVariants).where(eq(contentVariants.id, variantId)).get();
  if (!variant) return;
  const siblings = db.select().from(contentVariants).where(eq(contentVariants.pieceId, variant.pieceId)).all();
  const statuses = new Set(siblings.map((s) => s.status));
  let next: (typeof siblings)[number]["status"] | null = null;
  if (siblings.every((s) => s.status === "PUBLISHED")) next = "PUBLISHED";
  else if (statuses.has("NEEDS_CHANGES")) next = "NEEDS_CHANGES";
  else if (statuses.has("READY_FOR_APPROVAL")) next = "READY_FOR_APPROVAL";
  else if (siblings.every((s) => ["APPROVED", "SCHEDULED", "PUBLISHED", "PUBLISHING"].includes(s.status))) next = "APPROVED";
  if (next) db.update(contentPieces).set({ status: next, updatedAt: nowIso() }).where(eq(contentPieces.id, variant.pieceId)).run();
}
