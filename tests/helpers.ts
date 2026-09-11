import { createDb, type Db } from "@/lib/db/client";
import { brandNetworks, brands, socialConnections } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { MockProvider } from "@/lib/llm/mock";
import { createPiece } from "@/lib/agents/orchestrator";
import { SETTING_KEYS, setSetting } from "@/lib/settings";
import type { Network } from "@/lib/networks";

export function testDb(): Db {
  return createDb(":memory:");
}

export function seedBrand(db: Db, overrides: Partial<{ forbiddenWords: string[]; networks: Network[] }> = {}) {
  const id = newId();
  const networks = overrides.networks ?? ["linkedin", "x"];
  db.insert(brands)
    .values({
      id,
      name: "Marca Test",
      slug: `marca-test-${id.slice(0, 6)}`,
      description: "Marca de prueba",
      products: ["Producto A"],
      audiences: ["Audiencia A"],
      voiceTone: "Directo",
      offers: ["Oferta A"],
      ctas: ["Escríbenos"],
      proofPoints: ["+10 clientes"],
      preferredWords: ["claridad"],
      forbiddenWords: overrides.forbiddenWords ?? ["milagro"],
      forbiddenPromises: ["resultados garantizados"],
      approvedExamples: ["Ejemplo aprobado"],
    })
    .run();
  for (const network of networks) {
    db.insert(brandNetworks).values({ id: newId(), brandId: id, network, handle: `@test-${network}` }).run();
    db.insert(socialConnections)
      .values({ id: newId(), brandId: id, network, label: "simulada", status: "simulada", dryRun: false })
      .run();
  }
  return id;
}

export function enablePublishing(db: Db, enabled: boolean, dryRun = false) {
  setSetting(db, SETTING_KEYS.publishingEnabled, enabled ? "true" : "false");
  setSetting(db, SETTING_KEYS.globalDryRun, dryRun ? "true" : "false");
}

export function makePiece(db: Db, brandId: string, networks: Network[] = ["linkedin", "x"]) {
  return createPiece(db, { brandId, topic: "Tema de prueba", campaign: "Campaña", goal: "Objetivo", networks }, "test");
}

export const mockDeps = (db: Db) => ({ db, provider: new MockProvider(), actorLabel: "test-orquestador" });
