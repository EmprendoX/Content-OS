import { createDb } from "@/lib/db/client";
import { SETTING_KEYS, setSetting, type LlmProviderName } from "@/lib/settings";
const provider = (process.argv[2] ?? "mock") as LlmProviderName;
const model = process.argv[3] ?? "";
const db = createDb();
setSetting(db, SETTING_KEYS.llmProvider, provider);
setSetting(db, SETTING_KEYS.llmModel, model);
console.log(`Proveedor de IA fijado en: ${provider}${model ? ` (${model})` : ""}`);
