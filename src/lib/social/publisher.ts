import { and, desc, eq, lte } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  contentVariants,
  mediaAssets,
  metrics,
  publishJobs,
  socialConnections,
  type ContentVariant,
  type PublishJob,
} from "@/lib/db/schema";
import { newId, nowIso } from "@/lib/ids";
import { decryptSecret } from "@/lib/security/crypto";
import { audit } from "@/lib/security/audit";
import { isGlobalDryRun, isPublishingEnabled } from "@/lib/settings";
import { assertPublishable, WorkflowError } from "@/lib/workflow/states";
import { transitionVariant } from "@/lib/workflow/transitions";
import { PublishPayloadSchema, type PublishPayload } from "@/lib/agents/schemas";
import { getConnector } from "./mock-connectors";

/**
 * PublisherAgent (12). Determinista, sin IA.
 *
 * REGLA CRÍTICA: solo procesa variantes en APPROVED o SCHEDULED. Cualquier otro
 * estado lanza WorkflowError("NOT_PUBLISHABLE") antes de tocar nada.
 * Además respeta el interruptor global y exige confirmación explícita.
 */

export interface PublishOptions {
  /** Etiqueta del actor humano o del planificador. */
  actor: string;
  /** Debe ser true: la interfaz pide confirmación antes de llamar. */
  confirmed: boolean;
  /** Forzar Dry Run aunque la conexión no lo tenga activo. */
  dryRun?: boolean;
}

export interface PublishOutcome {
  variant: ContentVariant;
  job: PublishJob;
}

export function buildPayload(db: Db, variant: ContentVariant): PublishPayload {
  const asset = variant.visualAssetId
    ? db.select().from(mediaAssets).where(eq(mediaAssets.id, variant.visualAssetId)).get()
    : undefined;
  const text = [variant.hook, "", variant.copy, "", variant.cta, variant.hashtags.join(" ")]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n")
    .trim();
  return PublishPayloadSchema.parse({
    variantId: variant.id,
    network: variant.network,
    format: variant.format,
    text: variant.network === "x" ? variant.copy : text,
    hashtags: variant.hashtags,
    mediaPath: asset?.storedPath ?? null,
    scheduledAt: variant.scheduledAt ?? null,
  });
}

export async function publishVariant(db: Db, variantId: string, options: PublishOptions): Promise<PublishOutcome> {
  if (!options.confirmed) {
    throw new WorkflowError("La publicación requiere confirmación explícita.", "NOT_PUBLISHABLE");
  }

  const variant = db.select().from(contentVariants).where(eq(contentVariants.id, variantId)).get();
  if (!variant) throw new Error(`Variante no encontrada: ${variantId}`);

  // 1. Regla crítica: estado publicable.
  assertPublishable(variant.status);

  // 2. Interruptor global.
  if (!isPublishingEnabled(db)) {
    audit(db, {
      actor: options.actor,
      action: "publish.blocked",
      entityType: "content_variant",
      entityId: variantId,
      details: { reason: "publishing_disabled" },
    });
    throw new WorkflowError(
      "Las publicaciones están desactivadas globalmente. Actívalas en Configuración.",
      "PUBLISHING_DISABLED",
    );
  }

  const connection = db
    .select()
    .from(socialConnections)
    .where(and(eq(socialConnections.brandId, variant.brandId), eq(socialConnections.network, variant.network)))
    .get();

  const dryRun = options.dryRun ?? (isGlobalDryRun(db) || !connection || connection.dryRun);
  const payload = buildPayload(db, variant);
  const connector = getConnector(variant.network);
  const previousStatus = variant.status;

  // El token solo se descifra aquí y solo se entrega al conector.
  const accessToken =
    !dryRun && connection?.encryptedToken ? decryptSecret(connection.encryptedToken) : undefined;

  const jobId = newId();
  db.insert(publishJobs)
    .values({
      id: jobId,
      variantId,
      connectionId: connection?.id ?? null,
      network: variant.network,
      dryRun,
      payload,
      attempts: 1,
      status: "pendiente",
    })
    .run();

  if (!dryRun) {
    transitionVariant(db, variantId, "PUBLISHING", "system", options.actor);
  }

  const result = await connector.publish(payload, { dryRun, accessToken });
  const executedAt = nowIso();

  if (result.ok) {
    db.update(publishJobs)
      .set({ status: "exito", response: result, executedAt })
      .where(eq(publishJobs.id, jobId))
      .run();
    if (!dryRun) {
      transitionVariant(db, variantId, "PUBLISHED", "system", options.actor, {
        publishedUrl: result.url,
        publishedAt: result.publishedAt ?? executedAt,
      });
    }
    audit(db, {
      actor: options.actor,
      action: dryRun ? "publish.dry_run" : "publish.success",
      entityType: "content_variant",
      entityId: variantId,
      details: { jobId, network: variant.network, url: result.url, previousStatus },
    });
  } else {
    db.update(publishJobs)
      .set({ status: "fallido", response: result, error: result.error, executedAt })
      .where(eq(publishJobs.id, jobId))
      .run();
    if (!dryRun) {
      transitionVariant(db, variantId, "FAILED", "system", options.actor);
    }
    audit(db, {
      actor: options.actor,
      action: "publish.failed",
      entityType: "content_variant",
      entityId: variantId,
      details: { jobId, network: variant.network, error: result.error, dryRun },
    });
  }

  return {
    variant: db.select().from(contentVariants).where(eq(contentVariants.id, variantId)).get()!,
    job: db.select().from(publishJobs).where(eq(publishJobs.id, jobId)).get()!,
  };
}

/** Publica todas las variantes SCHEDULED cuya fecha ya pasó. */
export async function runDuePublications(db: Db, now: Date = new Date(), actor = "planificador") {
  const due = db
    .select()
    .from(contentVariants)
    .where(and(eq(contentVariants.status, "SCHEDULED"), lte(contentVariants.scheduledAt, now.toISOString())))
    .all();

  const outcomes: { variantId: string; ok: boolean; error?: string }[] = [];
  for (const variant of due) {
    try {
      const outcome = await publishVariant(db, variant.id, { actor, confirmed: true });
      outcomes.push({ variantId: variant.id, ok: outcome.job.status === "exito", error: outcome.job.error ?? undefined });
    } catch (error) {
      outcomes.push({ variantId: variant.id, ok: false, error: (error as Error).message });
      if ((error as WorkflowError).code === "PUBLISHING_DISABLED") break;
    }
  }
  return outcomes;
}

/** Recoge métricas simuladas de una variante publicada. */
export async function collectMetrics(db: Db, variantId: string, actor = "analytics") {
  const variant = db.select().from(contentVariants).where(eq(contentVariants.id, variantId)).get();
  if (!variant) throw new Error(`Variante no encontrada: ${variantId}`);
  if (variant.status !== "PUBLISHED" || !variant.publishedUrl) {
    throw new Error("Solo se pueden recoger métricas de contenido publicado.");
  }
  const connector = getConnector(variant.network);
  const externalId = variant.publishedUrl.split("/").pop() ?? variant.id;
  const snapshot = await connector.fetchMetrics(externalId);
  db.insert(metrics)
    .values({ id: newId(), variantId, network: variant.network, ...snapshot })
    .run();
  audit(db, { actor, action: "metrics.collect", entityType: "content_variant", entityId: variantId, details: snapshot });
  return snapshot;
}

export function listJobsForVariant(db: Db, variantId: string) {
  return db.select().from(publishJobs).where(eq(publishJobs.variantId, variantId)).orderBy(desc(publishJobs.createdAt)).all();
}
