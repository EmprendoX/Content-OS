import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { settings } from "@/lib/db/schema";
import { nowIso } from "@/lib/ids";

export const SETTING_KEYS = {
  publishingEnabled: "publishing_enabled",
  globalDryRun: "global_dry_run",
  llmProvider: "llm_provider",
  llmModel: "llm_model",
} as const;

export type LlmProviderName = "mock" | "anthropic" | "openai" | "ollama";

export function getSetting(db: Db, key: string): string | undefined {
  return db.select().from(settings).where(eq(settings.key, key)).get()?.value;
}

export function setSetting(db: Db, key: string, value: string): void {
  db.insert(settings)
    .values({ key, value, updatedAt: nowIso() })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: nowIso() } })
    .run();
}

/** Interruptor global: si está desactivado, ninguna publicación se ejecuta. */
export function isPublishingEnabled(db: Db): boolean {
  const stored = getSetting(db, SETTING_KEYS.publishingEnabled);
  if (stored !== undefined) return stored === "true";
  return (process.env.PUBLISHING_ENABLED ?? "false") === "true";
}

export function isGlobalDryRun(db: Db): boolean {
  const stored = getSetting(db, SETTING_KEYS.globalDryRun);
  return stored === undefined ? true : stored === "true";
}

export function getLlmProviderName(db: Db): LlmProviderName {
  const stored = getSetting(db, SETTING_KEYS.llmProvider) ?? process.env.LLM_PROVIDER ?? "mock";
  return (["mock", "anthropic", "openai", "ollama"] as const).includes(stored as LlmProviderName)
    ? (stored as LlmProviderName)
    : "mock";
}

export function getLlmModel(db: Db): string | undefined {
  return getSetting(db, SETTING_KEYS.llmModel) || undefined;
}
