"use server";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { brandNetworks, brands } from "@/lib/db/schema";
import { newId, nowIso, slugify } from "@/lib/ids";
import { isNetwork, NETWORKS, type Network } from "@/lib/networks";
import { audit } from "@/lib/security/audit";
import { HUMAN_ACTOR, parseLines, safeAction, str } from "./shared";

export async function saveBrandAction(form: FormData) {
  return safeAction(async () => {
    const db = getDb();
    const id = str(form, "id") || newId();
    const name = str(form, "name");
    if (!name) throw new Error("El nombre es obligatorio.");

    const data = {
      name,
      description: str(form, "description"),
      color: str(form, "color") || "#2563eb",
      products: parseLines(form.get("products")),
      audiences: parseLines(form.get("audiences")),
      voiceTone: str(form, "voiceTone"),
      offers: parseLines(form.get("offers")),
      ctas: parseLines(form.get("ctas")),
      proofPoints: parseLines(form.get("proofPoints")),
      preferredWords: parseLines(form.get("preferredWords")),
      forbiddenWords: parseLines(form.get("forbiddenWords")),
      forbiddenPromises: parseLines(form.get("forbiddenPromises")),
      approvedExamples: parseLines(form.get("approvedExamples")),
      updatedAt: nowIso(),
    };

    const existing = db.select().from(brands).where(eq(brands.id, id)).get();
    if (existing) {
      db.update(brands).set(data).where(eq(brands.id, id)).run();
    } else {
      const baseSlug = slugify(name) || id.slice(0, 8);
      const slugTaken = db.select().from(brands).where(eq(brands.slug, baseSlug)).get();
      db.insert(brands).values({ ...data, id, slug: slugTaken ? `${baseSlug}-${id.slice(0, 4)}` : baseSlug }).run();
    }

    // Redes asociadas
    const selected = NETWORKS.filter((n) => form.get(`network_${n}`) === "on");
    const current = db.select().from(brandNetworks).where(eq(brandNetworks.brandId, id)).all();
    for (const network of NETWORKS) {
      const handle = str(form, `handle_${network}`);
      const row = current.find((c) => c.network === network);
      if (selected.includes(network)) {
        if (row) db.update(brandNetworks).set({ handle, enabled: true }).where(eq(brandNetworks.id, row.id)).run();
        else db.insert(brandNetworks).values({ id: newId(), brandId: id, network, handle, enabled: true }).run();
      } else if (row) {
        db.update(brandNetworks).set({ enabled: false }).where(and(eq(brandNetworks.id, row.id))).run();
      }
    }

    audit(db, { actor: HUMAN_ACTOR, action: existing ? "brand.update" : "brand.create", entityType: "brand", entityId: id, details: { name } });
    return { id };
  }, "Marca guardada.");
}

export async function setBrandNetworkAction(brandId: string, network: string, enabled: boolean) {
  return safeAction(async () => {
    if (!isNetwork(network)) throw new Error("Red no válida.");
    const db = getDb();
    const row = db
      .select()
      .from(brandNetworks)
      .where(and(eq(brandNetworks.brandId, brandId), eq(brandNetworks.network, network as Network)))
      .get();
    if (row) db.update(brandNetworks).set({ enabled }).where(eq(brandNetworks.id, row.id)).run();
    else db.insert(brandNetworks).values({ id: newId(), brandId, network: network as Network, enabled }).run();
  });
}
