import { PageHeader } from "@/components/shared/page-header";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { getDb } from "@/lib/db/client";
import { getLlmModel, getLlmProviderName, isGlobalDryRun, isPublishingEnabled } from "@/lib/settings";
import { encryptionKeySource } from "@/lib/security/crypto";
import { listAuditEntries } from "@/lib/queries";
import { resolveDatabasePath } from "@/lib/db/client";

export default function SettingsPage() {
  const db = getDb();
  return (
    <div>
      <PageHeader title="Configuración" description="Interruptores globales, proveedor de IA, seguridad y registro de auditoría." />
      <SettingsPanel
        publishingEnabled={isPublishingEnabled(db)}
        globalDryRun={isGlobalDryRun(db)}
        provider={getLlmProviderName(db)}
        model={getLlmModel(db) ?? ""}
        env={{
          anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
          openai: Boolean(process.env.OPENAI_API_KEY),
          ollamaUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
          keySource: encryptionKeySource(),
          dbPath: resolveDatabasePath(),
        }}
        audit={listAuditEntries(150)}
      />
    </div>
  );
}
