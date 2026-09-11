"use server";

import fs from "node:fs";
import { getDb, resolveDatabasePath } from "@/lib/db/client";
import { seed } from "@/lib/db/seed";
import { audit } from "@/lib/security/audit";
import { SETTING_KEYS, setSetting, type LlmProviderName } from "@/lib/settings";
import { HUMAN_ACTOR, safeAction } from "./shared";

export async function setPublishingEnabledAction(enabled: boolean) {
  return safeAction(async () => {
    const db = getDb();
    setSetting(db, SETTING_KEYS.publishingEnabled, enabled ? "true" : "false");
    audit(db, { actor: HUMAN_ACTOR, action: enabled ? "settings.publishing_on" : "settings.publishing_off", entityType: "settings", entityId: SETTING_KEYS.publishingEnabled });
  }, enabled ? "Publicaciones activadas." : "Publicaciones desactivadas globalmente.");
}

export async function setGlobalDryRunAction(enabled: boolean) {
  return safeAction(async () => {
    const db = getDb();
    setSetting(db, SETTING_KEYS.globalDryRun, enabled ? "true" : "false");
    audit(db, { actor: HUMAN_ACTOR, action: "settings.global_dry_run", entityType: "settings", entityId: SETTING_KEYS.globalDryRun, details: { enabled } });
  }, enabled ? "Dry Run global activado." : "Dry Run global desactivado.");
}

export async function setLlmProviderAction(provider: LlmProviderName, model: string) {
  return safeAction(async () => {
    const db = getDb();
    setSetting(db, SETTING_KEYS.llmProvider, provider);
    setSetting(db, SETTING_KEYS.llmModel, model.trim());
    audit(db, { actor: HUMAN_ACTOR, action: "settings.llm", entityType: "settings", entityId: SETTING_KEYS.llmProvider, details: { provider, model } });
  }, "Proveedor de IA actualizado.");
}

/** Regenera los datos de demostración. Borra la base de datos local (no los archivos multimedia). */
export async function resetDemoAction() {
  return safeAction(async () => {
    const dbPath = resolveDatabasePath();
    if (dbPath === ":memory:") throw new Error("Base en memoria: no se puede resetear.");
    const current = globalThis.__contentOsDb;
    if (current) {
      // Cerramos la conexión antes de borrar el archivo.
      (current as unknown as { $client: { close: () => void } }).$client.close();
      globalThis.__contentOsDb = undefined;
    }
    for (const suffix of ["", "-wal", "-shm"]) {
      const file = `${dbPath}${suffix}`;
      if (fs.existsSync(/* turbopackIgnore: true */ file)) fs.rmSync(/* turbopackIgnore: true */ file);
    }
    await seed(getDb());
  }, "Datos de demostración regenerados.");
}
