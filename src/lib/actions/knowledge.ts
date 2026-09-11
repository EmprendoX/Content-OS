"use server";

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { knowledgeItems, type KnowledgeType } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { audit } from "@/lib/security/audit";
import { HUMAN_ACTOR, safeAction, str } from "./shared";

const TYPES: KnowledgeType[] = ["documento", "enlace", "nota", "dato", "ejemplo"];

export async function saveKnowledgeAction(form: FormData) {
  return safeAction(async () => {
    const db = getDb();
    const title = str(form, "title");
    if (!title) throw new Error("El título es obligatorio.");
    const type = str(form, "type") as KnowledgeType;
    const id = str(form, "id") || newId();
    const data = {
      brandId: str(form, "brandId") || null,
      title,
      type: TYPES.includes(type) ? type : "nota",
      content: str(form, "content"),
      sourceUrl: str(form, "sourceUrl") || null,
      tags: str(form, "tags")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };
    const existing = db.select().from(knowledgeItems).where(eq(knowledgeItems.id, id)).get();
    if (existing) db.update(knowledgeItems).set(data).where(eq(knowledgeItems.id, id)).run();
    else db.insert(knowledgeItems).values({ id, ...data }).run();
    audit(db, { actor: HUMAN_ACTOR, action: existing ? "knowledge.update" : "knowledge.create", entityType: "knowledge_item", entityId: id, details: { title } });
    return { id };
  }, "Elemento guardado en la biblioteca.");
}

export async function deleteKnowledgeAction(id: string) {
  return safeAction(async () => {
    const db = getDb();
    db.delete(knowledgeItems).where(eq(knowledgeItems.id, id)).run();
    audit(db, { actor: HUMAN_ACTOR, action: "knowledge.delete", entityType: "knowledge_item", entityId: id });
  }, "Elemento eliminado.");
}
