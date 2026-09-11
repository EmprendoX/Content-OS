import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { agentRuns, auditLog, contentPieces, contentVariants, variantVersions } from "@/lib/db/schema";
import { regenerateVariant, runPipeline } from "@/lib/agents/orchestrator";
import { MasterOutputSchema, ResearchOutputSchema, StrategyOutputSchema } from "@/lib/agents/schemas";
import { transitionVariant } from "@/lib/workflow/transitions";
import { makePiece, mockDeps, seedBrand, testDb } from "./helpers";

describe("orquestador de agentes", () => {
  let db: Db;
  let brandId: string;

  beforeEach(() => {
    db = testDb();
    brandId = seedBrand(db);
  });

  it("ejecuta el pipeline completo con MockProvider y termina en READY_FOR_APPROVAL", async () => {
    const piece = makePiece(db, brandId, ["linkedin", "x", "instagram"]);
    const result = await runPipeline(piece.id, mockDeps(db));

    expect(result.status).toBe("READY_FOR_APPROVAL");
    expect(ResearchOutputSchema.safeParse(result.research).success).toBe(true);
    expect(StrategyOutputSchema.safeParse(result.strategy).success).toBe(true);
    expect(MasterOutputSchema.safeParse(result.master).success).toBe(true);

    const variants = db.select().from(contentVariants).where(eq(contentVariants.pieceId, piece.id)).all();
    expect(variants).toHaveLength(3);
    for (const v of variants) {
      expect(v.status).toBe("READY_FOR_APPROVAL");
      expect(v.copy.length).toBeGreaterThan(0);
      expect(v.review).toBeTruthy();
      expect(v.visualBrief).toBeTruthy();
    }

    // Las adaptaciones son realmente distintas entre redes.
    const copies = new Set(variants.map((v) => v.copy));
    expect(copies.size).toBe(3);
    const x = variants.find((v) => v.network === "x")!;
    for (const post of x.copy.split(/\n\s*\n/)) expect(post.length).toBeLessThanOrEqual(280);

    // research + strategy + master + 3 adapt + 3 visual + 3 review + editor = 13 ejecuciones
    const runs = db.select().from(agentRuns).where(eq(agentRuns.pieceId, piece.id)).all();
    expect(runs).toHaveLength(13);
    expect(runs.every((r) => r.status === "exito")).toBe(true);
  });

  it("ningún agente deja una variante en APPROVED", async () => {
    const piece = makePiece(db, brandId);
    await runPipeline(piece.id, mockDeps(db));
    const variants = db.select().from(contentVariants).where(eq(contentVariants.pieceId, piece.id)).all();
    expect(variants.some((v) => v.status === "APPROVED" || v.status === "SCHEDULED")).toBe(false);
    const approvals = db
      .select()
      .from(auditLog)
      .all()
      .filter((a) => a.action === "variant.transition" && (a.details as { to: string }).to === "APPROVED");
    expect(approvals).toHaveLength(0);
  });

  it("devuelve NEEDS_CHANGES cuando el contenido contiene una palabra prohibida", async () => {
    // El mock incluye el nombre de la marca en hashtags y copy; lo usamos como palabra prohibida.
    const strictBrand = seedBrand(db, { forbiddenWords: ["marca test"], networks: ["linkedin"] });
    const piece = makePiece(db, strictBrand, ["linkedin"]);
    const result = await runPipeline(piece.id, mockDeps(db));
    expect(result.status).toBe("NEEDS_CHANGES");
    const variant = db.select().from(contentVariants).where(eq(contentVariants.pieceId, piece.id)).get()!;
    expect(variant.status).toBe("NEEDS_CHANGES");
    expect(variant.reviewerComments).toMatch(/prohibida/);
  });

  it("guarda historial de versiones y no borra las anteriores al regenerar", async () => {
    const piece = makePiece(db, brandId, ["linkedin"]);
    await runPipeline(piece.id, mockDeps(db));
    const variant = db.select().from(contentVariants).where(eq(contentVariants.pieceId, piece.id)).get()!;
    expect(variant.version).toBe(1);
    expect(db.select().from(variantVersions).where(eq(variantVersions.variantId, variant.id)).all()).toHaveLength(1);

    // Regenerar desde READY_FOR_APPROVAL exige que un humano la devuelva a cambios.
    await expect(regenerateVariant(variant.id, mockDeps(db))).rejects.toThrow(/Devuélvela a cambios/);
    transitionVariant(db, variant.id, "NEEDS_CHANGES", "human", "test");
    const regenerated = await regenerateVariant(variant.id, mockDeps(db));
    expect(regenerated.version).toBe(2);
    expect(regenerated.status).toBe("READY_FOR_APPROVAL");
    expect(db.select().from(variantVersions).where(eq(variantVersions.variantId, variant.id)).all()).toHaveLength(2);
  });

  it("no permite iniciar el pipeline desde un estado intermedio", async () => {
    const piece = makePiece(db, brandId);
    await runPipeline(piece.id, mockDeps(db));
    db.update(contentPieces).set({ status: "APPROVED" }).where(eq(contentPieces.id, piece.id)).run();
    await expect(runPipeline(piece.id, mockDeps(db))).rejects.toThrow(/solo puede iniciarse/);
  });
});
