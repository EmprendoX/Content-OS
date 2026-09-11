import { desc } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { auditLog } from "@/lib/db/schema";
import { newId } from "@/lib/ids";

export interface AuditInput {
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: unknown;
}

/** Registra una acción en el log de auditoría. Nunca se borra. */
export function audit(db: Db, input: AuditInput): void {
  db.insert(auditLog)
    .values({
      id: newId(),
      actor: input.actor,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      details: input.details ?? null,
    })
    .run();
}

export function listAudit(db: Db, limit = 100) {
  return db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(limit).all();
}
