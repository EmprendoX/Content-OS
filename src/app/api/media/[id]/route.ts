import fs from "node:fs";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { mediaAssets } from "@/lib/db/schema";

/** Sirve un archivo multimedia local por id (solo localhost). */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const asset = getDb().select().from(mediaAssets).where(eq(mediaAssets.id, id)).get();
  if (!asset || !fs.existsSync(asset.storedPath)) {
    return new NextResponse("No encontrado", { status: 404 });
  }
  const data = fs.readFileSync(asset.storedPath);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "content-type": asset.mimeType,
      "content-length": String(data.length),
      "cache-control": "private, max-age=3600",
    },
  });
}
