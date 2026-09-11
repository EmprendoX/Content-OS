"use server";

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { ideas, type IdeaStatus } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { isNetwork, type Network } from "@/lib/networks";
import { audit } from "@/lib/security/audit";
import { getLlmProvider } from "@/lib/llm";
import { createPiece, runPipeline } from "@/lib/agents/orchestrator";
import { HUMAN_ACTOR, safeAction, str } from "./shared";

export async function saveIdeaAction(form: FormData) {
  return safeAction(async () => {
    const db = getDb();
    const title = str(form, "title");
    const brandId = str(form, "brandId");
    if (!title) throw new Error("El título es obligatorio.");
    if (!brandId) throw new Error("Selecciona una marca.");
    const id = str(form, "id") || newId();
    const data = {
      brandId,
      title,
      description: str(form, "description"),
      campaign: str(form, "campaign"),
      goal: str(form, "goal"),
      priority: Number(str(form, "priority") || 2),
    };
    const existing = db.select().from(ideas).where(eq(ideas.id, id)).get();
    if (existing) db.update(ideas).set(data).where(eq(ideas.id, id)).run();
    else db.insert(ideas).values({ id, ...data }).run();
    audit(db, { actor: HUMAN_ACTOR, action: existing ? "idea.update" : "idea.create", entityType: "idea", entityId: id, details: { title } });
    return { id };
  }, "Idea guardada.");
}

export async function setIdeaStatusAction(id: string, status: IdeaStatus) {
  return safeAction(async () => {
    const db = getDb();
    db.update(ideas).set({ status }).where(eq(ideas.id, id)).run();
    audit(db, { actor: HUMAN_ACTOR, action: "idea.status", entityType: "idea", entityId: id, details: { status } });
  });
}

/**
 * Convierte una idea en pieza de contenido y ejecuta el pipeline de agentes.
 * Termina en READY_FOR_APPROVAL o NEEDS_CHANGES: nunca aprueba.
 */
export async function generateFromIdeaAction(ideaId: string, networks: string[]) {
  return safeAction(async () => {
    const db = getDb();
    const idea = db.select().from(ideas).where(eq(ideas.id, ideaId)).get();
    if (!idea) throw new Error("Idea no encontrada.");
    const selected = networks.filter(isNetwork) as Network[];
    if (selected.length === 0) throw new Error("Selecciona al menos una red.");

    const piece = createPiece(
      db,
      { brandId: idea.brandId, ideaId, topic: idea.title, campaign: idea.campaign, goal: idea.goal, networks: selected },
      HUMAN_ACTOR,
    );
    db.update(ideas).set({ status: "en_proceso", pieceId: piece.id }).where(eq(ideas.id, ideaId)).run();
    const result = await runPipeline(piece.id, { db, provider: getLlmProvider(db), actorLabel: "orquestador" });
    db.update(ideas).set({ status: "convertida" }).where(eq(ideas.id, ideaId)).run();
    return { pieceId: piece.id, status: result.status };
  }, "Contenido generado. Revísalo en el Estudio.");
}
