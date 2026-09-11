"use server";

import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { contentVariants, mediaAssets } from "@/lib/db/schema";
import { newId, nowIso, slugify } from "@/lib/ids";
import { audit } from "@/lib/security/audit";
import { HUMAN_ACTOR, safeAction, str } from "./shared";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "video/mp4", "application/pdf"]);
const MAX_BYTES = 50 * 1024 * 1024;

function mediaDir(): string {
  const dir = path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.MEDIA_DIR ?? "./data/media");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Sube un archivo a ./data/media y opcionalmente lo asocia a una variante. */
export async function uploadMediaAction(form: FormData) {
  return safeAction(async () => {
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("Selecciona un archivo.");
    if (!ALLOWED.has(file.type)) throw new Error(`Tipo no permitido: ${file.type || "desconocido"}.`);
    if (file.size > MAX_BYTES) throw new Error("El archivo supera 50 MB.");

    const db = getDb();
    const id = newId();
    const ext = path.extname(file.name) || "";
    const safeName = `${slugify(path.basename(file.name, ext)) || "archivo"}-${id.slice(0, 8)}${ext.toLowerCase()}`;
    const dir = mediaDir();
    const storedPath = path.join(dir, safeName);
    fs.writeFileSync(storedPath, Buffer.from(await file.arrayBuffer()));

    db.insert(mediaAssets)
      .values({
        id,
        brandId: str(form, "brandId") || null,
        filename: file.name,
        storedPath,
        mimeType: file.type,
        size: file.size,
        alt: str(form, "alt"),
      })
      .run();

    const variantId = str(form, "variantId");
    if (variantId) {
      db.update(contentVariants).set({ visualAssetId: id, updatedAt: nowIso() }).where(eq(contentVariants.id, variantId)).run();
    }
    audit(db, { actor: HUMAN_ACTOR, action: "media.upload", entityType: "media_asset", entityId: id, details: { filename: file.name, size: file.size, variantId: variantId || null } });
    return { id };
  }, "Archivo guardado.");
}

export async function attachMediaAction(variantId: string, assetId: string | null) {
  return safeAction(async () => {
    const db = getDb();
    db.update(contentVariants).set({ visualAssetId: assetId, updatedAt: nowIso() }).where(eq(contentVariants.id, variantId)).run();
    audit(db, { actor: HUMAN_ACTOR, action: "variant.attach_media", entityType: "content_variant", entityId: variantId, details: { assetId } });
  }, assetId ? "Archivo visual asociado." : "Archivo visual retirado.");
}
