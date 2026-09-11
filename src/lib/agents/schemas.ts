import { z } from "zod";
import { NETWORKS } from "@/lib/networks";
import { CONTENT_STATES } from "@/lib/workflow/states";

/**
 * Contratos JSON entre agentes. Cada agente recibe y devuelve objetos que
 * cumplen estos esquemas. No existe texto libre como contrato interno.
 */

export const NetworkSchema = z.enum(NETWORKS);
export const ContentStateSchema = z.enum(CONTENT_STATES);

// ---------------------------------------------------------------------------
// Contexto de marca (derivado de la tabla brands, sin tokens ni secretos)
// ---------------------------------------------------------------------------
export const BrandContextSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  products: z.array(z.string()),
  audiences: z.array(z.string()),
  voiceTone: z.string(),
  offers: z.array(z.string()),
  ctas: z.array(z.string()),
  proofPoints: z.array(z.string()),
  preferredWords: z.array(z.string()),
  forbiddenWords: z.array(z.string()),
  forbiddenPromises: z.array(z.string()),
  approvedExamples: z.array(z.string()),
});
export type BrandContext = z.infer<typeof BrandContextSchema>;

export const KnowledgeRefSchema = z.object({
  title: z.string(),
  type: z.string(),
  content: z.string(),
  sourceUrl: z.string().nullable().optional(),
});

// ---------------------------------------------------------------------------
// 1. ResearchAgent
// ---------------------------------------------------------------------------
export const ResearchInputSchema = z.object({
  brand: BrandContextSchema,
  topic: z.string().min(1),
  campaign: z.string(),
  goal: z.string(),
  knowledge: z.array(KnowledgeRefSchema),
});
export type ResearchInput = z.infer<typeof ResearchInputSchema>;

export const ResearchOutputSchema = z.object({
  summary: z.string().min(1),
  keyInsights: z.array(z.string()).min(1),
  audiencePains: z.array(z.string()).min(1),
  angles: z.array(z.string()).min(1),
  sources: z.array(z.object({ title: z.string(), note: z.string() })),
  risks: z.array(z.string()),
});
export type ResearchOutput = z.infer<typeof ResearchOutputSchema>;

// ---------------------------------------------------------------------------
// 2. StrategyAgent
// ---------------------------------------------------------------------------
export const StrategyInputSchema = z.object({
  brand: BrandContextSchema,
  topic: z.string(),
  campaign: z.string(),
  goal: z.string(),
  networks: z.array(NetworkSchema).min(1),
  research: ResearchOutputSchema,
});
export type StrategyInput = z.infer<typeof StrategyInputSchema>;

export const NetworkPlanSchema = z.object({
  network: NetworkSchema,
  format: z.string(),
  objective: z.string(),
  priority: z.number().int().min(1).max(3),
});

export const StrategyOutputSchema = z.object({
  objective: z.string().min(1),
  coreMessage: z.string().min(1),
  contentPillar: z.string(),
  angle: z.string().min(1),
  keyPoints: z.array(z.string()).min(1),
  toneNotes: z.string(),
  networkPlan: z.array(NetworkPlanSchema).min(1),
});
export type StrategyOutput = z.infer<typeof StrategyOutputSchema>;

// ---------------------------------------------------------------------------
// 3. MasterContentAgent
// ---------------------------------------------------------------------------
/** Instrucciones humanas para una regeneración (comentarios del revisor). */
export const FeedbackSchema = z
  .object({
    reviewerComments: z.string(),
    previousAttempt: z.string().nullable(),
  })
  .nullable()
  .optional();

export const MasterInputSchema = z.object({
  brand: BrandContextSchema,
  topic: z.string(),
  research: ResearchOutputSchema,
  strategy: StrategyOutputSchema,
  feedback: FeedbackSchema,
});
export type MasterInput = z.infer<typeof MasterInputSchema>;

export const MasterOutputSchema = z.object({
  title: z.string().min(1),
  hook: z.string().min(1),
  body: z.string().min(1),
  keyMessage: z.string().min(1),
  cta: z.string().min(1),
  proofPointsUsed: z.array(z.string()),
  wordCount: z.number().int().nonnegative(),
});
export type MasterOutput = z.infer<typeof MasterOutputSchema>;

// ---------------------------------------------------------------------------
// 4-8. Adaptadores por red
// ---------------------------------------------------------------------------
export const AdapterInputSchema = z.object({
  brand: BrandContextSchema,
  network: NetworkSchema,
  plan: NetworkPlanSchema,
  master: MasterOutputSchema,
  constraints: z.object({
    maxChars: z.number().int(),
    formats: z.array(z.string()),
    hashtagRange: z.tuple([z.number().int(), z.number().int()]),
    tone: z.string(),
  }),
  feedback: FeedbackSchema,
});
export type AdapterInput = z.infer<typeof AdapterInputSchema>;

export const AdapterOutputSchema = z.object({
  network: NetworkSchema,
  format: z.string().min(1),
  hook: z.string().min(1),
  copy: z.string().min(1),
  cta: z.string().min(1),
  hashtags: z.array(z.string()),
  notes: z.string(),
});
export type AdapterOutput = z.infer<typeof AdapterOutputSchema>;

// ---------------------------------------------------------------------------
// 9. VisualBriefAgent
// ---------------------------------------------------------------------------
export const VisualBriefInputSchema = z.object({
  brand: BrandContextSchema,
  adaptation: AdapterOutputSchema,
  aspectRatios: z.array(z.string()),
});
export type VisualBriefInput = z.infer<typeof VisualBriefInputSchema>;

export const VisualBriefOutputSchema = z.object({
  concept: z.string().min(1),
  aspectRatio: z.string(),
  style: z.string(),
  textOverlay: z.string(),
  colorPalette: z.array(z.string()),
  altText: z.string().min(1),
  assetsNeeded: z.array(z.string()),
});
export type VisualBriefOutput = z.infer<typeof VisualBriefOutputSchema>;

// ---------------------------------------------------------------------------
// 10. ReviewAgent
// ---------------------------------------------------------------------------
export const ReviewIssueSchema = z.object({
  type: z.enum(["palabra_prohibida", "promesa_prohibida", "longitud", "tono", "cta", "claridad", "otro"]),
  severity: z.enum(["baja", "media", "alta"]),
  message: z.string(),
});

export const ReviewInputSchema = z.object({
  brand: BrandContextSchema,
  adaptation: AdapterOutputSchema,
  maxChars: z.number().int(),
});
export type ReviewInput = z.infer<typeof ReviewInputSchema>;

export const ReviewOutputSchema = z.object({
  score: z.number().min(0).max(100),
  passed: z.boolean(),
  issues: z.array(ReviewIssueSchema),
  suggestions: z.array(z.string()),
});
export type ReviewOutput = z.infer<typeof ReviewOutputSchema>;

// ---------------------------------------------------------------------------
// 11. EditorChiefAgent — solo recomienda; nunca aprueba.
// ---------------------------------------------------------------------------
export const EditorChiefInputSchema = z.object({
  brand: BrandContextSchema,
  topic: z.string(),
  variants: z.array(
    z.object({
      variantId: z.string(),
      network: NetworkSchema,
      adaptation: AdapterOutputSchema,
      review: ReviewOutputSchema,
    }),
  ),
});
export type EditorChiefInput = z.infer<typeof EditorChiefInputSchema>;

/** El editor solo puede recomendar estos dos estados. APPROVED está excluido a propósito. */
export const EditorDecisionSchema = z.enum(["READY_FOR_APPROVAL", "NEEDS_CHANGES"]);

export const EditorChiefOutputSchema = z.object({
  summary: z.string().min(1),
  overallDecision: EditorDecisionSchema,
  perVariant: z.array(
    z.object({
      variantId: z.string(),
      decision: EditorDecisionSchema,
      comments: z.string(),
    }),
  ),
});
export type EditorChiefOutput = z.infer<typeof EditorChiefOutputSchema>;

// ---------------------------------------------------------------------------
// 12. PublisherAgent — determinista, sin LLM.
// ---------------------------------------------------------------------------
export const PublishPayloadSchema = z.object({
  variantId: z.string(),
  network: NetworkSchema,
  format: z.string(),
  text: z.string(),
  hashtags: z.array(z.string()),
  mediaPath: z.string().nullable(),
  scheduledAt: z.string().nullable(),
});
export type PublishPayload = z.infer<typeof PublishPayloadSchema>;

export const PublishResultSchema = z.object({
  ok: z.boolean(),
  dryRun: z.boolean(),
  externalId: z.string().nullable(),
  url: z.string().nullable(),
  publishedAt: z.string().nullable(),
  error: z.string().nullable(),
  raw: z.unknown().optional(),
});
export type PublishResult = z.infer<typeof PublishResultSchema>;

// ---------------------------------------------------------------------------
// 13. AnalyticsAgent
// ---------------------------------------------------------------------------
export const MetricsSnapshotSchema = z.object({
  variantId: z.string(),
  network: NetworkSchema,
  topic: z.string(),
  format: z.string(),
  impressions: z.number().int().nonnegative(),
  reach: z.number().int().nonnegative(),
  likes: z.number().int().nonnegative(),
  comments: z.number().int().nonnegative(),
  shares: z.number().int().nonnegative(),
  saves: z.number().int().nonnegative(),
  clicks: z.number().int().nonnegative(),
});
export type MetricsSnapshot = z.infer<typeof MetricsSnapshotSchema>;

export const AnalyticsInputSchema = z.object({
  brand: BrandContextSchema,
  metrics: z.array(MetricsSnapshotSchema),
});
export type AnalyticsInput = z.infer<typeof AnalyticsInputSchema>;

export const AnalyticsOutputSchema = z.object({
  summary: z.string().min(1),
  topPerformers: z.array(z.object({ variantId: z.string(), reason: z.string() })),
  learnings: z.array(z.string()),
  recommendations: z.array(z.string()),
  suggestedIdeas: z.array(z.object({ title: z.string(), rationale: z.string() })),
});
export type AnalyticsOutput = z.infer<typeof AnalyticsOutputSchema>;
