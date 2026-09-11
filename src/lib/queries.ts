import "server-only";
import { and, desc, eq, gte, inArray, lt, or, sql } from "drizzle-orm";
import { addDays, startOfWeek } from "date-fns";
import { getDb } from "@/lib/db/client";
import {
  agentRuns,
  brandNetworks,
  brands,
  contentPieces,
  contentVariants,
  ideas,
  knowledgeItems,
  mediaAssets,
  metrics,
  publishJobs,
  socialConnections,
  variantVersions,
  type Brand,
  type ContentPiece,
  type ContentVariant,
  type MediaAsset,
  type MetricRow,
} from "@/lib/db/schema";
import { NETWORKS, type Network } from "@/lib/networks";
import { CONTENT_STATES, type ContentState } from "@/lib/workflow/states";
import { listAudit } from "@/lib/security/audit";

// ---------------------------------------------------------------------------
// Marcas
// ---------------------------------------------------------------------------
export function listBrands() {
  return getDb().select().from(brands).orderBy(brands.name).all();
}

export function getBrand(id: string) {
  const db = getDb();
  const brand = db.select().from(brands).where(eq(brands.id, id)).get();
  if (!brand) return null;
  const networks = db.select().from(brandNetworks).where(eq(brandNetworks.brandId, id)).all();
  return { ...brand, networks };
}

export function listBrandNetworks(brandId: string): Network[] {
  return getDb()
    .select()
    .from(brandNetworks)
    .where(and(eq(brandNetworks.brandId, brandId), eq(brandNetworks.enabled, true)))
    .all()
    .map((n) => n.network);
}

export function brandsById(): Record<string, Brand> {
  return Object.fromEntries(listBrands().map((b) => [b.id, b]));
}

// ---------------------------------------------------------------------------
// Biblioteca e ideas
// ---------------------------------------------------------------------------
export function listKnowledge(brandId?: string) {
  const db = getDb();
  const query = db.select().from(knowledgeItems).orderBy(desc(knowledgeItems.createdAt));
  return brandId ? query.where(eq(knowledgeItems.brandId, brandId)).all() : query.all();
}

export function listIdeas(brandId?: string) {
  const db = getDb();
  const query = db.select().from(ideas).orderBy(ideas.priority, desc(ideas.createdAt));
  return brandId ? query.where(eq(ideas.brandId, brandId)).all() : query.all();
}

// ---------------------------------------------------------------------------
// Estudio
// ---------------------------------------------------------------------------
export interface PieceSummary extends ContentPiece {
  brand: Brand;
  variantCount: number;
  variantStates: ContentState[];
}

export function listPieces(brandId?: string): PieceSummary[] {
  const db = getDb();
  const brandMap = brandsById();
  const query = db.select().from(contentPieces).orderBy(desc(contentPieces.updatedAt));
  const rows = brandId ? query.where(eq(contentPieces.brandId, brandId)).all() : query.all();
  const variants = db.select().from(contentVariants).all();
  return rows.map((piece) => {
    const own = variants.filter((v) => v.pieceId === piece.id);
    return { ...piece, brand: brandMap[piece.brandId], variantCount: own.length, variantStates: own.map((v) => v.status) };
  });
}

export function getPieceDetail(id: string) {
  const db = getDb();
  const piece = db.select().from(contentPieces).where(eq(contentPieces.id, id)).get();
  if (!piece) return null;
  const brand = db.select().from(brands).where(eq(brands.id, piece.brandId)).get()!;
  const variants = db.select().from(contentVariants).where(eq(contentVariants.pieceId, id)).all();
  const runs = db.select().from(agentRuns).where(eq(agentRuns.pieceId, id)).orderBy(agentRuns.createdAt).all();
  const variantIds = variants.map((v) => v.id);
  const versions = variantIds.length
    ? db.select().from(variantVersions).where(inArray(variantVersions.variantId, variantIds)).orderBy(desc(variantVersions.version)).all()
    : [];
  const jobs = variantIds.length
    ? db.select().from(publishJobs).where(inArray(publishJobs.variantId, variantIds)).orderBy(desc(publishJobs.createdAt)).all()
    : [];
  const assets = db.select().from(mediaAssets).where(or(eq(mediaAssets.brandId, piece.brandId), sql`${mediaAssets.brandId} IS NULL`)).all();
  return { piece, brand, variants, runs, versions, jobs, assets };
}

// ---------------------------------------------------------------------------
// Hoja de aprobación
// ---------------------------------------------------------------------------
export interface ApprovalRow {
  id: string;
  pieceId: string;
  date: string;
  brandId: string;
  brandName: string;
  brandColor: string;
  campaign: string;
  topic: string;
  network: Network;
  format: string;
  hook: string;
  copy: string;
  cta: string;
  hashtags: string[];
  visualAssetId: string | null;
  visualAssetName: string | null;
  reviewerComments: string;
  status: ContentState;
  version: number;
  scheduledAt: string | null;
  publishedUrl: string | null;
  metrics: { impressions: number; likes: number; comments: number; shares: number; clicks: number } | null;
  reviewScore: number | null;
}

export function listApprovalRows(filter: { brandId?: string; status?: ContentState; network?: Network } = {}): ApprovalRow[] {
  const db = getDb();
  const brandMap = brandsById();
  const conditions = [];
  if (filter.brandId) conditions.push(eq(contentVariants.brandId, filter.brandId));
  if (filter.status) conditions.push(eq(contentVariants.status, filter.status));
  if (filter.network) conditions.push(eq(contentVariants.network, filter.network));

  const rows = db
    .select({ variant: contentVariants, piece: contentPieces })
    .from(contentVariants)
    .innerJoin(contentPieces, eq(contentVariants.pieceId, contentPieces.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(contentVariants.updatedAt))
    .all();

  const assets = Object.fromEntries(db.select().from(mediaAssets).all().map((a) => [a.id, a]));
  const latestMetrics = latestMetricsByVariant(rows.map((r) => r.variant.id));

  return rows.map(({ variant, piece }) => {
    const brand = brandMap[variant.brandId];
    const m = latestMetrics[variant.id];
    return {
      id: variant.id,
      pieceId: piece.id,
      date: variant.createdAt,
      brandId: brand.id,
      brandName: brand.name,
      brandColor: brand.color,
      campaign: piece.campaign,
      topic: piece.topic,
      network: variant.network,
      format: variant.format,
      hook: variant.hook,
      copy: variant.copy,
      cta: variant.cta,
      hashtags: variant.hashtags,
      visualAssetId: variant.visualAssetId,
      visualAssetName: variant.visualAssetId ? (assets[variant.visualAssetId]?.filename ?? null) : null,
      reviewerComments: variant.reviewerComments,
      status: variant.status,
      version: variant.version,
      scheduledAt: variant.scheduledAt,
      publishedUrl: variant.publishedUrl,
      metrics: m ? { impressions: m.impressions, likes: m.likes, comments: m.comments, shares: m.shares, clicks: m.clicks } : null,
      reviewScore: (variant.review as { score?: number } | null)?.score ?? null,
    };
  });
}

function latestMetricsByVariant(variantIds: string[]): Record<string, MetricRow> {
  if (variantIds.length === 0) return {};
  const rows = getDb().select().from(metrics).where(inArray(metrics.variantId, variantIds)).orderBy(desc(metrics.collectedAt)).all();
  const result: Record<string, MetricRow> = {};
  for (const row of rows) if (!result[row.variantId]) result[row.variantId] = row;
  return result;
}

// ---------------------------------------------------------------------------
// Calendario
// ---------------------------------------------------------------------------
export interface CalendarItem {
  id: string;
  pieceId: string;
  brandName: string;
  brandColor: string;
  topic: string;
  network: Network;
  status: ContentState;
  at: string;
}

export function listCalendarItems(weekStart: Date): CalendarItem[] {
  const db = getDb();
  const brandMap = brandsById();
  const from = weekStart.toISOString();
  const to = addDays(weekStart, 7).toISOString();
  const rows = db
    .select({ variant: contentVariants, piece: contentPieces })
    .from(contentVariants)
    .innerJoin(contentPieces, eq(contentVariants.pieceId, contentPieces.id))
    .where(
      or(
        and(gte(contentVariants.scheduledAt, from), lt(contentVariants.scheduledAt, to)),
        and(gte(contentVariants.publishedAt, from), lt(contentVariants.publishedAt, to)),
      ),
    )
    .all();
  return rows
    .map(({ variant, piece }) => ({
      id: variant.id,
      pieceId: piece.id,
      brandName: brandMap[variant.brandId].name,
      brandColor: brandMap[variant.brandId].color,
      topic: piece.topic,
      network: variant.network,
      status: variant.status,
      at: (variant.status === "PUBLISHED" ? variant.publishedAt : variant.scheduledAt) ?? variant.scheduledAt ?? variant.publishedAt!,
    }))
    .sort((a, b) => a.at.localeCompare(b.at));
}

export function currentWeekStart(offset = 0): Date {
  return addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), offset * 7);
}

// ---------------------------------------------------------------------------
// Conexiones
// ---------------------------------------------------------------------------
export function listConnections() {
  const db = getDb();
  const brandMap = brandsById();
  return db
    .select()
    .from(socialConnections)
    .orderBy(socialConnections.brandId, socialConnections.network)
    .all()
    .map((c) => ({
      id: c.id,
      brandId: c.brandId,
      brandName: brandMap[c.brandId]?.name ?? "—",
      brandColor: brandMap[c.brandId]?.color ?? "#999",
      network: c.network,
      label: c.label,
      status: c.status,
      dryRun: c.dryRun,
      hasToken: Boolean(c.encryptedToken),
      updatedAt: c.updatedAt,
    }));
}

export function listRecentJobs(limit = 30) {
  const db = getDb();
  const brandMap = brandsById();
  return db
    .select({ job: publishJobs, variant: contentVariants, piece: contentPieces })
    .from(publishJobs)
    .innerJoin(contentVariants, eq(publishJobs.variantId, contentVariants.id))
    .innerJoin(contentPieces, eq(contentVariants.pieceId, contentPieces.id))
    .orderBy(desc(publishJobs.createdAt))
    .limit(limit)
    .all()
    .map(({ job, variant, piece }) => ({
      ...job,
      topic: piece.topic,
      pieceId: piece.id,
      brandName: brandMap[variant.brandId]?.name ?? "—",
    }));
}

// ---------------------------------------------------------------------------
// Resultados
// ---------------------------------------------------------------------------
export interface ResultRow {
  variantId: string;
  pieceId: string;
  brandId: string;
  brandName: string;
  brandColor: string;
  topic: string;
  network: Network;
  format: string;
  publishedAt: string | null;
  publishedUrl: string | null;
  metrics: MetricRow | null;
}

export function listResults(brandId?: string): ResultRow[] {
  const db = getDb();
  const brandMap = brandsById();
  const conditions = [eq(contentVariants.status, "PUBLISHED")];
  if (brandId) conditions.push(eq(contentVariants.brandId, brandId));
  const rows = db
    .select({ variant: contentVariants, piece: contentPieces })
    .from(contentVariants)
    .innerJoin(contentPieces, eq(contentVariants.pieceId, contentPieces.id))
    .where(and(...conditions))
    .orderBy(desc(contentVariants.publishedAt))
    .all();
  const latest = latestMetricsByVariant(rows.map((r) => r.variant.id));
  return rows.map(({ variant, piece }) => ({
    variantId: variant.id,
    pieceId: piece.id,
    brandId: variant.brandId,
    brandName: brandMap[variant.brandId].name,
    brandColor: brandMap[variant.brandId].color,
    topic: piece.topic,
    network: variant.network,
    format: variant.format,
    publishedAt: variant.publishedAt,
    publishedUrl: variant.publishedUrl,
    metrics: latest[variant.id] ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export function dashboardData() {
  const db = getDb();
  const brandMap = brandsById();
  const variants = db
    .select({ variant: contentVariants, piece: contentPieces })
    .from(contentVariants)
    .innerJoin(contentPieces, eq(contentVariants.pieceId, contentPieces.id))
    .orderBy(desc(contentVariants.updatedAt))
    .all();

  const counts = Object.fromEntries(CONTENT_STATES.map((s) => [s, 0])) as Record<ContentState, number>;
  for (const { variant } of variants) counts[variant.status] += 1;

  const pending = variants
    .filter(({ variant }) => variant.status === "READY_FOR_APPROVAL" || variant.status === "NEEDS_CHANGES")
    .slice(0, 8)
    .map(({ variant, piece }) => ({
      id: variant.id,
      pieceId: piece.id,
      brandName: brandMap[variant.brandId].name,
      brandColor: brandMap[variant.brandId].color,
      topic: piece.topic,
      network: variant.network,
      status: variant.status,
      hook: variant.hook,
      reviewScore: (variant.review as { score?: number } | null)?.score ?? null,
    }));

  const failed = variants
    .filter(({ variant }) => variant.status === "FAILED")
    .map(({ variant, piece }) => {
      const job = db
        .select()
        .from(publishJobs)
        .where(eq(publishJobs.variantId, variant.id))
        .orderBy(desc(publishJobs.createdAt))
        .get();
      return {
        id: variant.id,
        pieceId: piece.id,
        brandName: brandMap[variant.brandId].name,
        topic: piece.topic,
        network: variant.network,
        error: job?.error ?? piece.error ?? "Error desconocido",
        attempts: job?.attempts ?? 0,
      };
    });

  const week = listCalendarItems(currentWeekStart());
  const results = listResults().slice(0, 5);
  const pieces = db.select().from(contentPieces).all();
  const pieceCounts = Object.fromEntries(CONTENT_STATES.map((s) => [s, 0])) as Record<ContentState, number>;
  for (const p of pieces) pieceCounts[p.status] += 1;

  return {
    counts,
    pieceCounts,
    pending,
    failed,
    week,
    results,
    totals: {
      brands: Object.keys(brandMap).length,
      pieces: pieces.length,
      variants: variants.length,
      pendingReview: counts.READY_FOR_APPROVAL + counts.NEEDS_CHANGES,
      scheduled: counts.SCHEDULED,
      published: counts.PUBLISHED,
      failed: counts.FAILED,
    },
  };
}

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------
export function listAuditEntries(limit = 100) {
  return listAudit(getDb(), limit);
}

export function listMedia(brandId?: string): MediaAsset[] {
  const db = getDb();
  const query = db.select().from(mediaAssets).orderBy(desc(mediaAssets.createdAt));
  return brandId ? query.where(eq(mediaAssets.brandId, brandId)).all() : query.all();
}

export function getVariant(id: string): ContentVariant | undefined {
  return getDb().select().from(contentVariants).where(eq(contentVariants.id, id)).get();
}

export { NETWORKS };
