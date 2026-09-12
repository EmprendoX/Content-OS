import { and, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  agentRuns,
  brands,
  contentPieces,
  contentVariants,
  knowledgeItems,
  ideas,
  type ContentPiece,
  type ContentVariant,
} from "@/lib/db/schema";
import { newId, nowIso } from "@/lib/ids";
import type { LLMProvider } from "@/lib/llm/provider";
import { NETWORK_SPECS, type Network } from "@/lib/networks";
import { audit } from "@/lib/security/audit";
import { saveVariantVersion, transitionPiece, transitionVariant } from "@/lib/workflow/transitions";
import {
  ADAPTERS,
  AnalyticsAgent,
  EditorChiefAgent,
  MasterContentAgent,
  ResearchAgent,
  ReviewAgent,
  StrategyAgent,
  VisualBriefAgent,
  runAgent,
  type AgentDefinition,
} from "./agents";
import { toBrandContext, toKnowledgeRefs } from "./context";
import {
  AdapterOutputSchema,
  MasterOutputSchema,
  ResearchOutputSchema,
  ReviewOutputSchema,
  StrategyOutputSchema,
  type AdapterOutput,
  type BrandContext,
  type AnalyticsInput,
  type AnalyticsOutput,
  type EditorChiefOutput,
  type ReviewOutput,
} from "./schemas";

export interface OrchestratorDeps {
  db: Db;
  provider: LLMProvider;
  /** Etiqueta del actor para auditoría (p. ej. "orquestador"). */
  actorLabel?: string;
}

/** Ejecuta un agente y registra la ejecución en agent_runs. */
async function step<I, O>(
  deps: OrchestratorDeps,
  agent: AgentDefinition<I, O>,
  input: unknown,
  refs: { pieceId?: string; variantId?: string },
): Promise<O> {
  const started = Date.now();
  try {
    const output = await runAgent(agent, deps.provider, input);
    deps.db
      .insert(agentRuns)
      .values({
        id: newId(),
        pieceId: refs.pieceId ?? null,
        variantId: refs.variantId ?? null,
        agent: agent.name,
        provider: deps.provider.name,
        status: "exito",
        input,
        output,
        durationMs: Date.now() - started,
      })
      .run();
    return output;
  } catch (error) {
    deps.db
      .insert(agentRuns)
      .values({
        id: newId(),
        pieceId: refs.pieceId ?? null,
        variantId: refs.variantId ?? null,
        agent: agent.name,
        provider: deps.provider.name,
        status: "fallido",
        input,
        error: (error as Error).message,
        durationMs: Date.now() - started,
      })
      .run();
    throw error;
  }
}

function loadPiece(db: Db, pieceId: string): ContentPiece {
  const piece = db.select().from(contentPieces).where(eq(contentPieces.id, pieceId)).get();
  if (!piece) throw new Error(`Pieza no encontrada: ${pieceId}`);
  return piece;
}

function loadBrandContext(db: Db, brandId: string) {
  const brand = db.select().from(brands).where(eq(brands.id, brandId)).get();
  if (!brand) throw new Error(`Marca no encontrada: ${brandId}`);
  return { brand, context: toBrandContext(brand) };
}

/**
 * Crea una pieza a partir de una idea (o de datos sueltos) en estado IDEA.
 */
export function createPiece(
  db: Db,
  input: { brandId: string; ideaId?: string; topic: string; campaign?: string; goal?: string; networks: Network[] },
  actorLabel = "humano",
): ContentPiece {
  const id = newId();
  db.insert(contentPieces)
    .values({
      id,
      brandId: input.brandId,
      ideaId: input.ideaId ?? null,
      topic: input.topic,
      campaign: input.campaign ?? "",
      goal: input.goal ?? "",
      networks: input.networks,
      status: "IDEA",
    })
    .run();
  if (input.ideaId) {
    db.update(ideas).set({ status: "convertida", pieceId: id }).where(eq(ideas.id, input.ideaId)).run();
  }
  audit(db, { actor: actorLabel, action: "piece.create", entityType: "content_piece", entityId: id, details: input });
  return loadPiece(db, id);
}

/**
 * Pipeline completo: investigación → estrategia → pieza maestra → adaptaciones
 * → brief visual → revisión → editor jefe. Termina en READY_FOR_APPROVAL o
 * NEEDS_CHANGES. Nunca en APPROVED.
 */
export async function runPipeline(pieceId: string, deps: OrchestratorDeps): Promise<ContentPiece> {
  const { db } = deps;
  const actorLabel = deps.actorLabel ?? "orquestador";
  let piece = loadPiece(db, pieceId);
  const { context: brand } = loadBrandContext(db, piece.brandId);

  try {
    if (piece.status === "NEEDS_CHANGES") {
      // Conserva investigación, estrategia y pieza maestra: solo regenera adaptaciones.
      return await regenerateAdaptations(piece, brand, deps);
    }
    if (piece.status !== "IDEA" && piece.status !== "FAILED") {
      throw new Error(`El pipeline solo puede iniciarse desde IDEA o FAILED (estado actual: ${piece.status}).`);
    }

    // 1. Investigación
    transitionPiece(db, pieceId, "RESEARCHING", "agent", actorLabel);
    const knowledge = db
      .select()
      .from(knowledgeItems)
      .where(eq(knowledgeItems.brandId, piece.brandId))
      .all();
    const research = await step(
      deps,
      ResearchAgent,
      { brand, topic: piece.topic, campaign: piece.campaign, goal: piece.goal, knowledge: toKnowledgeRefs(knowledge) },
      { pieceId },
    );

    // 2. Estrategia
    const strategy = await step(
      deps,
      StrategyAgent,
      { brand, topic: piece.topic, campaign: piece.campaign, goal: piece.goal, networks: piece.networks, research },
      { pieceId },
    );
    db.update(contentPieces).set({ research, strategy, updatedAt: nowIso() }).where(eq(contentPieces.id, pieceId)).run();
    transitionPiece(db, pieceId, "MASTER_DRAFT", "agent", actorLabel);

    // 3. Pieza maestra
    const master = await step(deps, MasterContentAgent, { brand, topic: piece.topic, research, strategy }, { pieceId });
    db.update(contentPieces).set({ master, updatedAt: nowIso() }).where(eq(contentPieces.id, pieceId)).run();
    transitionPiece(db, pieceId, "ADAPTING", "agent", actorLabel);

    // 4-6. Adaptaciones, brief visual, revisión y editor jefe
    return await adaptReviewDecide(loadPiece(db, pieceId), brand, deps);
  } catch (error) {
    piece = loadPiece(db, pieceId);
    if (piece.status !== "FAILED" && piece.status !== "IDEA") {
      try {
        transitionPiece(db, pieceId, "FAILED", "agent", actorLabel, { error: (error as Error).message });
      } catch {
        // Si el estado actual no admite FAILED, lo forzamos con error registrado.
        db.update(contentPieces).set({ status: "FAILED" }).where(eq(contentPieces.id, pieceId)).run();
      }
    }
    db.update(contentPieces).set({ error: (error as Error).message, updatedAt: nowIso() }).where(eq(contentPieces.id, pieceId)).run();
    throw error;
  }
}

/** Desde NEEDS_CHANGES: vuelve a ADAPTING y regenera solo las adaptaciones. */
async function regenerateAdaptations(
  piece: ContentPiece,
  brand: BrandContext,
  deps: OrchestratorDeps,
): Promise<ContentPiece> {
  const actorLabel = deps.actorLabel ?? "orquestador";
  transitionPiece(deps.db, piece.id, "ADAPTING", "agent", actorLabel);
  return adaptReviewDecide(loadPiece(deps.db, piece.id), brand, deps);
}

/**
 * Pasos 4-6 del pipeline. Requiere piece.status === ADAPTING y pieza maestra
 * y estrategia ya guardadas.
 */
async function adaptReviewDecide(
  piece: ContentPiece,
  brand: BrandContext,
  deps: OrchestratorDeps,
): Promise<ContentPiece> {
  const { db } = deps;
  const actorLabel = deps.actorLabel ?? "orquestador";
  const pieceId = piece.id;
  const master = MasterOutputSchema.parse(piece.master);
  const strategy = StrategyOutputSchema.parse(piece.strategy);

  // 4. Adaptaciones + brief visual: las redes son independientes, se generan en paralelo.
  // better-sqlite3 es síncrono, así que las escrituras no se solapan.
  const variantIds = await Promise.all(
    piece.networks.map(async (network) => {
      const plan = strategy.networkPlan.find((p) => p.network === network) ?? {
        network,
        format: NETWORK_SPECS[network].defaultFormat,
        objective: strategy.objective,
        priority: 2,
      };
      const spec = NETWORK_SPECS[network];
      const adaptation = await step(
        deps,
        ADAPTERS[network],
        {
          brand,
          network,
          plan,
          master,
          constraints: { maxChars: spec.maxChars, formats: spec.formats, hashtagRange: spec.hashtagRange, tone: spec.tone },
        },
        { pieceId },
      );
      const visualBrief = await step(
        deps,
        VisualBriefAgent,
        { brand, adaptation, aspectRatios: spec.aspectRatios },
        { pieceId },
      );
      return upsertVariant(db, piece, adaptation, visualBrief, actorLabel);
    }),
  );

  // 5. Revisión (también en paralelo)
  transitionPiece(db, pieceId, "IN_REVIEW", "agent", actorLabel);
  const reviewed: { variantId: string; network: Network; adaptation: AdapterOutput; review: ReviewOutput }[] = await Promise.all(
    variantIds.map(async (variantId) => {
      const variant = db.select().from(contentVariants).where(eq(contentVariants.id, variantId)).get()!;
      if (variant.status !== "IN_REVIEW") transitionVariant(db, variantId, "IN_REVIEW", "agent", actorLabel);
      const adaptation = variantToAdaptation(variant);
      const review = await step(
        deps,
        ReviewAgent,
        { brand, adaptation, maxChars: NETWORK_SPECS[variant.network].maxChars },
        { pieceId, variantId },
      );
      db.update(contentVariants).set({ review, updatedAt: nowIso() }).where(eq(contentVariants.id, variantId)).run();
      return { variantId, network: variant.network, adaptation, review };
    }),
  );

  // 6. Editor jefe: recomienda READY_FOR_APPROVAL o NEEDS_CHANGES. Nunca APPROVED.
  const decision = await step(deps, EditorChiefAgent, { brand, topic: piece.topic, variants: reviewed }, { pieceId });
  applyEditorDecision(db, pieceId, decision, actorLabel);
  return loadPiece(db, pieceId);
}

function upsertVariant(
  db: Db,
  piece: ContentPiece,
  adaptation: AdapterOutput,
  visualBrief: unknown,
  actorLabel: string,
): string {
  const existing = db
    .select()
    .from(contentVariants)
    .where(and(eq(contentVariants.pieceId, piece.id), eq(contentVariants.network, adaptation.network)))
    .get();

  if (existing) {
    saveVariantVersion(db, existing, "Regeneración por el orquestador", actorLabel);
    db.update(contentVariants)
      .set({
        format: adaptation.format,
        hook: adaptation.hook,
        copy: adaptation.copy,
        cta: adaptation.cta,
        hashtags: adaptation.hashtags,
        visualBrief,
        review: null,
        status: "ADAPTING",
        version: existing.version + 1,
        updatedAt: nowIso(),
      })
      .where(eq(contentVariants.id, existing.id))
      .run();
    return existing.id;
  }

  const id = newId();
  db.insert(contentVariants)
    .values({
      id,
      pieceId: piece.id,
      brandId: piece.brandId,
      network: adaptation.network,
      format: adaptation.format,
      hook: adaptation.hook,
      copy: adaptation.copy,
      cta: adaptation.cta,
      hashtags: adaptation.hashtags,
      visualBrief,
      status: "ADAPTING",
      version: 1,
    })
    .run();
  const created = db.select().from(contentVariants).where(eq(contentVariants.id, id)).get()!;
  saveVariantVersion(db, created, "Versión inicial generada", actorLabel);
  return id;
}

export function variantToAdaptation(variant: ContentVariant): AdapterOutput {
  return AdapterOutputSchema.parse({
    network: variant.network,
    format: variant.format,
    hook: variant.hook,
    copy: variant.copy,
    cta: variant.cta,
    hashtags: variant.hashtags,
    notes: "",
  });
}

function applyEditorDecision(db: Db, pieceId: string, decision: EditorChiefOutput, actorLabel: string) {
  for (const item of decision.perVariant) {
    const variant = db.select().from(contentVariants).where(eq(contentVariants.id, item.variantId)).get();
    if (!variant) continue;
    // Solo estos dos destinos son posibles: el esquema Zod excluye APPROVED.
    const target = item.decision === "READY_FOR_APPROVAL" ? "READY_FOR_APPROVAL" : "NEEDS_CHANGES";
    transitionVariant(db, variant.id, target, "agent", actorLabel, { reviewerComments: item.comments });
  }
  db.update(contentPieces).set({ editorDecision: decision, updatedAt: nowIso() }).where(eq(contentPieces.id, pieceId)).run();
  transitionPiece(db, pieceId, decision.overallDecision, "agent", actorLabel);
}

/**
 * Regenera una sola variante desde la pieza maestra, la vuelve a revisar y
 * la deja en READY_FOR_APPROVAL o NEEDS_CHANGES.
 */
export async function regenerateVariant(variantId: string, deps: OrchestratorDeps): Promise<ContentVariant> {
  const { db } = deps;
  const actorLabel = deps.actorLabel ?? "orquestador";
  const variant = db.select().from(contentVariants).where(eq(contentVariants.id, variantId)).get();
  if (!variant) throw new Error(`Variante no encontrada: ${variantId}`);
  const piece = loadPiece(db, variant.pieceId);
  const { context: brand } = loadBrandContext(db, piece.brandId);
  const master = MasterOutputSchema.parse(piece.master);
  const strategy = StrategyOutputSchema.parse(piece.strategy);
  const spec = NETWORK_SPECS[variant.network];
  const plan = strategy.networkPlan.find((p) => p.network === variant.network) ?? {
    network: variant.network,
    format: spec.defaultFormat,
    objective: strategy.objective,
    priority: 2,
  };

  if (!["NEEDS_CHANGES", "FAILED", "ADAPTING"].includes(variant.status)) {
    throw new Error(
      `Solo se puede regenerar una variante en NEEDS_CHANGES, FAILED o ADAPTING (estado actual: ${variant.status}). Devuélvela a cambios primero.`,
    );
  }
  if (variant.status !== "ADAPTING") transitionVariant(db, variantId, "ADAPTING", "agent", actorLabel);
  // Los comentarios del revisor y el intento anterior viajan al adaptador como feedback.
  const feedback = variant.reviewerComments.trim()
    ? { reviewerComments: variant.reviewerComments, previousAttempt: `${variant.hook}\n\n${variant.copy}` }
    : null;
  const adaptation = await step(
    deps,
    ADAPTERS[variant.network],
    {
      brand,
      network: variant.network,
      plan,
      master,
      constraints: { maxChars: spec.maxChars, formats: spec.formats, hashtagRange: spec.hashtagRange, tone: spec.tone },
      feedback,
    },
    { pieceId: piece.id, variantId },
  );
  const visualBrief = await step(deps, VisualBriefAgent, { brand, adaptation, aspectRatios: spec.aspectRatios }, { pieceId: piece.id, variantId });
  upsertVariant(db, piece, adaptation, visualBrief, actorLabel);
  return reviewVariant(variantId, deps);
}

/** Revisa una variante (p. ej. tras edición humana) y fija su estado. */
export async function reviewVariant(variantId: string, deps: OrchestratorDeps): Promise<ContentVariant> {
  const { db } = deps;
  const actorLabel = deps.actorLabel ?? "orquestador";
  const variant = db.select().from(contentVariants).where(eq(contentVariants.id, variantId)).get();
  if (!variant) throw new Error(`Variante no encontrada: ${variantId}`);
  const piece = loadPiece(db, variant.pieceId);
  const { context: brand } = loadBrandContext(db, piece.brandId);

  if (variant.status !== "IN_REVIEW") transitionVariant(db, variantId, "IN_REVIEW", "agent", actorLabel);
  const adaptation = variantToAdaptation(variant);
  const review = await step(
    deps,
    ReviewAgent,
    { brand, adaptation, maxChars: NETWORK_SPECS[variant.network].maxChars },
    { pieceId: piece.id, variantId },
  );
  const decision = await step(
    deps,
    EditorChiefAgent,
    { brand, topic: piece.topic, variants: [{ variantId, network: variant.network, adaptation, review }] },
    { pieceId: piece.id, variantId },
  );
  const item = decision.perVariant[0];
  db.update(contentVariants).set({ review, updatedAt: nowIso() }).where(eq(contentVariants.id, variantId)).run();
  transitionVariant(db, variantId, item.decision, "agent", actorLabel, { reviewerComments: item.comments });
  return db.select().from(contentVariants).where(eq(contentVariants.id, variantId)).get()!;
}

/** AnalyticsAgent: analiza métricas de una marca. */
export async function runAnalytics(input: AnalyticsInput, deps: OrchestratorDeps): Promise<AnalyticsOutput> {
  return step(deps, AnalyticsAgent, input, {});
}

export { ResearchOutputSchema, StrategyOutputSchema, MasterOutputSchema, ReviewOutputSchema };
