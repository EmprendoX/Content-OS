"use server";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { socialConnections } from "@/lib/db/schema";
import { newId, nowIso } from "@/lib/ids";
import { isNetwork, type Network } from "@/lib/networks";
import { audit } from "@/lib/security/audit";
import { encryptSecret } from "@/lib/security/crypto";
import { HUMAN_ACTOR, safeAction, str } from "./shared";

export async function saveConnectionAction(form: FormData) {
  return safeAction(async () => {
    const db = getDb();
    const brandId = str(form, "brandId");
    const network = str(form, "network");
    if (!brandId || !isNetwork(network)) throw new Error("Marca y red son obligatorias.");
    const token = str(form, "token");
    const label = str(form, "label");
    const dryRun = form.get("dryRun") !== "off";

    const existing = db
      .select()
      .from(socialConnections)
      .where(and(eq(socialConnections.brandId, brandId), eq(socialConnections.network, network as Network)))
      .get();

    const data = {
      label: label || existing?.label || `${network} (simulada)`,
      dryRun,
      // El token se cifra antes de tocar la base de datos. Nunca se devuelve a la UI.
      ...(token ? { encryptedToken: encryptSecret(token) } : {}),
      status: "simulada" as const,
      updatedAt: nowIso(),
    };

    let id = existing?.id;
    if (existing) {
      db.update(socialConnections).set(data).where(eq(socialConnections.id, existing.id)).run();
    } else {
      id = newId();
      db.insert(socialConnections).values({ id, brandId, network: network as Network, ...data }).run();
    }
    audit(db, {
      actor: HUMAN_ACTOR,
      action: existing ? "connection.update" : "connection.create",
      entityType: "social_connection",
      entityId: id!,
      details: { network, dryRun, tokenUpdated: Boolean(token) },
    });
  }, "Conexión guardada.");
}

export async function toggleConnectionDryRunAction(id: string, dryRun: boolean) {
  return safeAction(async () => {
    const db = getDb();
    db.update(socialConnections).set({ dryRun, updatedAt: nowIso() }).where(eq(socialConnections.id, id)).run();
    audit(db, { actor: HUMAN_ACTOR, action: "connection.dry_run", entityType: "social_connection", entityId: id, details: { dryRun } });
  });
}

export async function removeTokenAction(id: string) {
  return safeAction(async () => {
    const db = getDb();
    db.update(socialConnections)
      .set({ encryptedToken: null, status: "desconectada", dryRun: true, updatedAt: nowIso() })
      .where(eq(socialConnections.id, id))
      .run();
    audit(db, { actor: HUMAN_ACTOR, action: "connection.remove_token", entityType: "social_connection", entityId: id });
  }, "Token eliminado. La conexión vuelve a Dry Run.");
}
