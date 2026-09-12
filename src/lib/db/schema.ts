import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import type { ContentState } from "@/lib/workflow/states";
import type { Network } from "@/lib/networks";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

const jsonText = <T>(name: string) => text(name, { mode: "json" }).$type<T>();

// ---------------------------------------------------------------------------
// Marcas
// ---------------------------------------------------------------------------
export const brands = sqliteTable("brands", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  color: text("color").notNull().default("#2563eb"),
  locale: text("locale").notNull().default("es-MX"),
  products: jsonText<string[]>("products").notNull().default([]),
  audiences: jsonText<string[]>("audiences").notNull().default([]),
  voiceTone: text("voice_tone").notNull().default(""),
  offers: jsonText<string[]>("offers").notNull().default([]),
  ctas: jsonText<string[]>("ctas").notNull().default([]),
  proofPoints: jsonText<string[]>("proof_points").notNull().default([]),
  preferredWords: jsonText<string[]>("preferred_words").notNull().default([]),
  forbiddenWords: jsonText<string[]>("forbidden_words").notNull().default([]),
  forbiddenPromises: jsonText<string[]>("forbidden_promises").notNull().default([]),
  approvedExamples: jsonText<string[]>("approved_examples").notNull().default([]),
  createdAt: text("created_at").notNull().default(now),
  updatedAt: text("updated_at").notNull().default(now),
});

export const brandNetworks = sqliteTable(
  "brand_networks",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
    network: text("network").$type<Network>().notNull(),
    handle: text("handle").notNull().default(""),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  },
  (t) => [index("brand_networks_brand_idx").on(t.brandId)],
);

// ---------------------------------------------------------------------------
// Biblioteca de conocimiento
// ---------------------------------------------------------------------------
export type KnowledgeType = "documento" | "enlace" | "nota" | "dato" | "ejemplo";

export const knowledgeItems = sqliteTable(
  "knowledge_items",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id").references(() => brands.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    type: text("type").$type<KnowledgeType>().notNull().default("nota"),
    content: text("content").notNull().default(""),
    sourceUrl: text("source_url"),
    tags: jsonText<string[]>("tags").notNull().default([]),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("knowledge_brand_idx").on(t.brandId)],
);

// ---------------------------------------------------------------------------
// Ideas
// ---------------------------------------------------------------------------
export type IdeaStatus = "abierta" | "en_proceso" | "convertida" | "archivada";

export const ideas = sqliteTable(
  "ideas",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    campaign: text("campaign").notNull().default(""),
    goal: text("goal").notNull().default(""),
    source: text("source").$type<"manual" | "agente">().notNull().default("manual"),
    priority: integer("priority").notNull().default(2),
    status: text("status").$type<IdeaStatus>().notNull().default("abierta"),
    pieceId: text("piece_id"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("ideas_brand_idx").on(t.brandId)],
);

// ---------------------------------------------------------------------------
// Piezas de contenido (pipeline) y variantes por red
// ---------------------------------------------------------------------------
export const contentPieces = sqliteTable(
  "content_pieces",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
    ideaId: text("idea_id").references(() => ideas.id, { onDelete: "set null" }),
    campaign: text("campaign").notNull().default(""),
    topic: text("topic").notNull(),
    goal: text("goal").notNull().default(""),
    status: text("status").$type<ContentState>().notNull().default("IDEA"),
    networks: jsonText<Network[]>("networks").notNull().default([]),
    research: jsonText<unknown>("research"),
    strategy: jsonText<unknown>("strategy"),
    master: jsonText<unknown>("master"),
    editorDecision: jsonText<unknown>("editor_decision"),
    error: text("error"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [index("pieces_brand_idx").on(t.brandId), index("pieces_status_idx").on(t.status)],
);

export const contentVariants = sqliteTable(
  "content_variants",
  {
    id: text("id").primaryKey(),
    pieceId: text("piece_id").notNull().references(() => contentPieces.id, { onDelete: "cascade" }),
    brandId: text("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
    network: text("network").$type<Network>().notNull(),
    format: text("format").notNull().default(""),
    hook: text("hook").notNull().default(""),
    copy: text("copy").notNull().default(""),
    cta: text("cta").notNull().default(""),
    hashtags: jsonText<string[]>("hashtags").notNull().default([]),
    visualBrief: jsonText<unknown>("visual_brief"),
    visualAssetId: text("visual_asset_id"),
    reviewerComments: text("reviewer_comments").notNull().default(""),
    review: jsonText<unknown>("review"),
    status: text("status").$type<ContentState>().notNull().default("ADAPTING"),
    version: integer("version").notNull().default(1),
    scheduledAt: text("scheduled_at"),
    publishedUrl: text("published_url"),
    publishedAt: text("published_at"),
    approvedAt: text("approved_at"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [
    index("variants_piece_idx").on(t.pieceId),
    index("variants_status_idx").on(t.status),
    index("variants_scheduled_idx").on(t.scheduledAt),
  ],
);

/** Historial de versiones: nunca se borra. */
export const variantVersions = sqliteTable(
  "variant_versions",
  {
    id: text("id").primaryKey(),
    variantId: text("variant_id").notNull().references(() => contentVariants.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    snapshot: jsonText<unknown>("snapshot").notNull(),
    reason: text("reason").notNull().default(""),
    actor: text("actor").notNull().default("system"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("versions_variant_idx").on(t.variantId)],
);

// ---------------------------------------------------------------------------
// Multimedia
// ---------------------------------------------------------------------------
export const mediaAssets = sqliteTable("media_assets", {
  id: text("id").primaryKey(),
  brandId: text("brand_id").references(() => brands.id, { onDelete: "set null" }),
  filename: text("filename").notNull(),
  storedPath: text("stored_path").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull().default(0),
  alt: text("alt").notNull().default(""),
  createdAt: text("created_at").notNull().default(now),
});

// ---------------------------------------------------------------------------
// Conexiones sociales y publicación
// ---------------------------------------------------------------------------
export type ConnectionStatus = "simulada" | "conectada" | "desconectada";

export const socialConnections = sqliteTable(
  "social_connections",
  {
    id: text("id").primaryKey(),
    brandId: text("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
    network: text("network").$type<Network>().notNull(),
    label: text("label").notNull().default(""),
    /** Token cifrado con AES-256-GCM. Nunca se expone a la UI ni a prompts. */
    encryptedToken: text("encrypted_token"),
    status: text("status").$type<ConnectionStatus>().notNull().default("simulada"),
    dryRun: integer("dry_run", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [index("connections_brand_idx").on(t.brandId)],
);

export type PublishJobStatus = "pendiente" | "exito" | "fallido" | "omitido";

export const publishJobs = sqliteTable(
  "publish_jobs",
  {
    id: text("id").primaryKey(),
    variantId: text("variant_id").notNull().references(() => contentVariants.id, { onDelete: "cascade" }),
    connectionId: text("connection_id"),
    network: text("network").$type<Network>().notNull(),
    dryRun: integer("dry_run", { mode: "boolean" }).notNull().default(true),
    payload: jsonText<unknown>("payload").notNull(),
    response: jsonText<unknown>("response"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    status: text("status").$type<PublishJobStatus>().notNull().default("pendiente"),
    createdAt: text("created_at").notNull().default(now),
    executedAt: text("executed_at"),
  },
  (t) => [index("jobs_variant_idx").on(t.variantId)],
);

// ---------------------------------------------------------------------------
// Ejecuciones de agentes, auditoría, métricas, configuración
// ---------------------------------------------------------------------------
export const agentRuns = sqliteTable(
  "agent_runs",
  {
    id: text("id").primaryKey(),
    pieceId: text("piece_id"),
    variantId: text("variant_id"),
    agent: text("agent").notNull(),
    provider: text("provider").notNull().default("mock"),
    status: text("status").$type<"exito" | "fallido">().notNull(),
    input: jsonText<unknown>("input"),
    output: jsonText<unknown>("output"),
    error: text("error"),
    durationMs: integer("duration_ms").notNull().default(0),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("runs_piece_idx").on(t.pieceId)],
);

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  details: jsonText<unknown>("details"),
  createdAt: text("created_at").notNull().default(now),
});

export const metrics = sqliteTable(
  "metrics",
  {
    id: text("id").primaryKey(),
    variantId: text("variant_id").notNull().references(() => contentVariants.id, { onDelete: "cascade" }),
    network: text("network").$type<Network>().notNull(),
    impressions: integer("impressions").notNull().default(0),
    reach: integer("reach").notNull().default(0),
    likes: integer("likes").notNull().default(0),
    comments: integer("comments").notNull().default(0),
    shares: integer("shares").notNull().default(0),
    saves: integer("saves").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    collectedAt: text("collected_at").notNull().default(now),
  },
  (t) => [index("metrics_variant_idx").on(t.variantId)],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(now),
});

// ---------------------------------------------------------------------------
// Tipos inferidos
// ---------------------------------------------------------------------------
export type Brand = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;
export type BrandNetwork = typeof brandNetworks.$inferSelect;
export type KnowledgeItem = typeof knowledgeItems.$inferSelect;
export type Idea = typeof ideas.$inferSelect;
export type ContentPiece = typeof contentPieces.$inferSelect;
export type ContentVariant = typeof contentVariants.$inferSelect;
export type VariantVersion = typeof variantVersions.$inferSelect;
export type MediaAsset = typeof mediaAssets.$inferSelect;
export type SocialConnection = typeof socialConnections.$inferSelect;
export type PublishJob = typeof publishJobs.$inferSelect;
export type AgentRun = typeof agentRuns.$inferSelect;
export type AuditEntry = typeof auditLog.$inferSelect;
export type MetricRow = typeof metrics.$inferSelect;
