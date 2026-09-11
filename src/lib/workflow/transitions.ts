import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { contentPieces, contentVariants, variantVersions, type ContentVariant } from "@/lib/db/schema";
import { newId, nowIso } from "@/lib/ids";
import { audit } from "@/lib/security/audit";
import { assertTransition, type Actor, type ContentState } from "./states";

/**
 * Cambios de estado persistidos. Toda transición pasa por assertTransition y
 * queda en el log de auditoría.
 */

export function transitionPiece(
  db: Db,
  pieceId: string,
  to: ContentState,
  actor: Actor,
  actorLabel: string = actor,
  details?: unknown,
) {
  const piece = db.select().from(contentPieces).where(eq(contentPieces.id, pieceId)).get();
  if (!piece) throw new Error(`Pieza no encontrada: ${pieceId}`);
  assertTransition(piece.status, to, actor);
  db.update(contentPieces).set({ status: to, updatedAt: nowIso() }).where(eq(contentPieces.id, pieceId)).run();
  audit(db, {
    actor: actorLabel,
    action: "piece.transition",
    entityType: "content_piece",
    entityId: pieceId,
    details: { from: piece.status, to, ...(details ? { details } : {}) },
  });
  return { ...piece, status: to };
}

export function transitionVariant(
  db: Db,
  variantId: string,
  to: ContentState,
  actor: Actor,
  actorLabel: string = actor,
  extra: Partial<Pick<ContentVariant, "scheduledAt" | "publishedUrl" | "publishedAt" | "approvedAt" | "reviewerComments">> = {},
) {
  const variant = db.select().from(contentVariants).where(eq(contentVariants.id, variantId)).get();
  if (!variant) throw new Error(`Variante no encontrada: ${variantId}`);
  assertTransition(variant.status, to, actor);
  db.update(contentVariants)
    .set({ status: to, updatedAt: nowIso(), ...extra })
    .where(eq(contentVariants.id, variantId))
    .run();
  audit(db, {
    actor: actorLabel,
    action: "variant.transition",
    entityType: "content_variant",
    entityId: variantId,
    details: { from: variant.status, to, network: variant.network, ...extra },
  });
  return { ...variant, status: to, ...extra };
}

/** Guarda una instantánea de la variante. Las versiones nunca se borran. */
export function saveVariantVersion(db: Db, variant: ContentVariant, reason: string, actor: string) {
  db.insert(variantVersions)
    .values({
      id: newId(),
      variantId: variant.id,
      version: variant.version,
      snapshot: {
        format: variant.format,
        hook: variant.hook,
        copy: variant.copy,
        cta: variant.cta,
        hashtags: variant.hashtags,
        visualBrief: variant.visualBrief,
        reviewerComments: variant.reviewerComments,
        status: variant.status,
      },
      reason,
      actor,
    })
    .run();
}
