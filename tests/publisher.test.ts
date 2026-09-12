import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { auditLog, contentVariants, publishJobs } from "@/lib/db/schema";
import { runPipeline } from "@/lib/agents/orchestrator";
import { buildPayload, publishVariant, runDuePublications } from "@/lib/social/publisher";
import { CONTENT_STATES, WorkflowError } from "@/lib/workflow/states";
import { transitionVariant } from "@/lib/workflow/transitions";
import { enablePublishing, makePiece, mockDeps, seedBrand, testDb } from "./helpers";

describe("PublisherAgent: bloqueo sin aprobación", () => {
  let db: Db;
  let brandId: string;

  beforeEach(async () => {
    db = testDb();
    brandId = seedBrand(db);
    enablePublishing(db, true, false);
  });

  async function readyVariant() {
    const piece = makePiece(db, brandId, ["linkedin"]);
    await runPipeline(piece.id, mockDeps(db));
    const variant = db.select().from(contentVariants).where(eq(contentVariants.pieceId, piece.id)).get()!;
    expect(variant.status).toBe("READY_FOR_APPROVAL");
    return variant;
  }

  it("rechaza publicar una variante READY_FOR_APPROVAL (no aprobada)", async () => {
    const variant = await readyVariant();
    await expect(publishVariant(db, variant.id, { actor: "test", confirmed: true })).rejects.toMatchObject({
      code: "NOT_PUBLISHABLE",
    });
    const jobs = db.select().from(publishJobs).all();
    expect(jobs).toHaveLength(0);
    const after = db.select().from(contentVariants).where(eq(contentVariants.id, variant.id)).get()!;
    expect(after.status).toBe("READY_FOR_APPROVAL");
  });

  it("rechaza publicar en cualquier estado que no sea APPROVED o SCHEDULED", async () => {
    const variant = await readyVariant();
    for (const state of CONTENT_STATES) {
      if (state === "APPROVED" || state === "SCHEDULED") continue;
      db.update(contentVariants).set({ status: state }).where(eq(contentVariants.id, variant.id)).run();
      await expect(publishVariant(db, variant.id, { actor: "test", confirmed: true })).rejects.toBeInstanceOf(
        WorkflowError,
      );
    }
    expect(db.select().from(publishJobs).all()).toHaveLength(0);
  });

  it("exige confirmación explícita", async () => {
    const variant = await readyVariant();
    transitionVariant(db, variant.id, "APPROVED", "human", "test");
    await expect(publishVariant(db, variant.id, { actor: "test", confirmed: false })).rejects.toThrow(/confirmación/);
  });

  it("publica (simulado) una variante aprobada por un humano", async () => {
    const variant = await readyVariant();
    transitionVariant(db, variant.id, "APPROVED", "human", "test");
    const outcome = await publishVariant(db, variant.id, { actor: "test", confirmed: true });
    expect(outcome.job.status).toBe("exito");
    expect(outcome.job.dryRun).toBe(false);
    expect(outcome.variant.status).toBe("PUBLISHED");
    expect(outcome.variant.publishedUrl).toMatch(/^https:\/\/linkedin\.example\.local\//);
    expect(outcome.job.payload).toMatchObject({ network: "linkedin", variantId: variant.id });
  });

  it("en Dry Run registra el payload sin cambiar el estado", async () => {
    const variant = await readyVariant();
    transitionVariant(db, variant.id, "APPROVED", "human", "test");
    const outcome = await publishVariant(db, variant.id, { actor: "test", confirmed: true, dryRun: true });
    expect(outcome.job.status).toBe("exito");
    expect(outcome.job.dryRun).toBe(true);
    expect(outcome.variant.status).toBe("APPROVED");
    expect(outcome.variant.publishedUrl).toBeNull();
  });

  it("respeta el interruptor global de publicaciones", async () => {
    const variant = await readyVariant();
    transitionVariant(db, variant.id, "APPROVED", "human", "test");
    enablePublishing(db, false);
    await expect(publishVariant(db, variant.id, { actor: "test", confirmed: true })).rejects.toMatchObject({
      code: "PUBLISHING_DISABLED",
    });
    const blocked = db.select().from(auditLog).where(eq(auditLog.action, "publish.blocked")).all();
    expect(blocked).toHaveLength(1);
  });

  it("marca FAILED y registra el error cuando el conector rechaza el payload", async () => {
    const igBrand = seedBrand(db, { networks: ["instagram"] });
    const piece = makePiece(db, igBrand, ["instagram"]);
    await runPipeline(piece.id, mockDeps(db));
    const variant = db.select().from(contentVariants).where(eq(contentVariants.pieceId, piece.id)).get()!;
    transitionVariant(db, variant.id, "APPROVED", "human", "test");
    // Instagram requiere archivo visual: el conector simulado falla.
    const outcome = await publishVariant(db, variant.id, { actor: "test", confirmed: true });
    expect(outcome.job.status).toBe("fallido");
    expect(outcome.job.error).toMatch(/archivo visual/);
    expect(outcome.job.attempts).toBe(1);
    expect(outcome.variant.status).toBe("FAILED");
  });

  it("el payload no duplica hook, CTA ni hashtags que ya están en el copy", async () => {
    const variant = await readyVariant();
    db.update(contentVariants)
      .set({
        hook: "Tu web pierde clientes en 5 segundos.",
        copy: "Tu web pierde clientes en 5 segundos.\n\nHaz el test.\n\nPide tu auditoría gratuita.",
        cta: "Pide tu auditoría gratuita",
        hashtags: ["#auditoriaweb", "#pymes"],
      })
      .where(eq(contentVariants.id, variant.id))
      .run();
    const payload = buildPayload(db, db.select().from(contentVariants).where(eq(contentVariants.id, variant.id)).get()!);
    expect(payload.text.match(/Tu web pierde clientes/g)).toHaveLength(1);
    expect(payload.text.match(/Pide tu auditoría gratuita/g)).toHaveLength(1);
    expect(payload.text.endsWith("#auditoriaweb #pymes")).toBe(true);

    // Si el copy no incluye el hook ni el CTA, se añaden.
    db.update(contentVariants).set({ copy: "Solo el cuerpo." }).where(eq(contentVariants.id, variant.id)).run();
    const payload2 = buildPayload(db, db.select().from(contentVariants).where(eq(contentVariants.id, variant.id)).get()!);
    expect(payload2.text.startsWith("Tu web pierde clientes")).toBe(true);
    expect(payload2.text).toContain("Pide tu auditoría gratuita");
  });

  it("el planificador solo procesa SCHEDULED con fecha vencida", async () => {
    const variant = await readyVariant();
    transitionVariant(db, variant.id, "APPROVED", "human", "test");
    transitionVariant(db, variant.id, "SCHEDULED", "human", "test", {
      scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    expect(await runDuePublications(db, new Date())).toHaveLength(0);
    const later = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const outcomes = await runDuePublications(db, later);
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].ok).toBe(true);
  });
});
