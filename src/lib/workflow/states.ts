/**
 * Máquina de estados del flujo editorial.
 *
 * Regla crítica: solo un actor humano puede llevar un registro a APPROVED o
 * SCHEDULED. Ningún agente ni proceso automático puede hacerlo.
 */

export const CONTENT_STATES = [
  "IDEA",
  "RESEARCHING",
  "MASTER_DRAFT",
  "ADAPTING",
  "IN_REVIEW",
  "NEEDS_CHANGES",
  "READY_FOR_APPROVAL",
  "APPROVED",
  "SCHEDULED",
  "PUBLISHING",
  "PUBLISHED",
  "FAILED",
] as const;

export type ContentState = (typeof CONTENT_STATES)[number];

export type Actor = "human" | "agent" | "system";

/** Estados que solo un humano puede asignar. */
export const HUMAN_ONLY_STATES: readonly ContentState[] = ["APPROVED", "SCHEDULED"];

/** Estados desde los que el PublisherAgent puede publicar. */
export const PUBLISHABLE_STATES: readonly ContentState[] = ["APPROVED", "SCHEDULED"];

/** Estados que solo el sistema de publicación puede asignar. */
export const SYSTEM_ONLY_STATES: readonly ContentState[] = ["PUBLISHING", "PUBLISHED"];

/** Transiciones válidas: origen -> destinos permitidos. */
export const TRANSITIONS: Record<ContentState, readonly ContentState[]> = {
  IDEA: ["RESEARCHING"],
  RESEARCHING: ["MASTER_DRAFT", "FAILED"],
  MASTER_DRAFT: ["ADAPTING", "FAILED"],
  ADAPTING: ["IN_REVIEW", "FAILED"],
  IN_REVIEW: ["NEEDS_CHANGES", "READY_FOR_APPROVAL", "FAILED"],
  NEEDS_CHANGES: ["IN_REVIEW", "ADAPTING", "READY_FOR_APPROVAL"],
  READY_FOR_APPROVAL: ["APPROVED", "NEEDS_CHANGES"],
  APPROVED: ["SCHEDULED", "PUBLISHING", "NEEDS_CHANGES"],
  SCHEDULED: ["PUBLISHING", "APPROVED", "NEEDS_CHANGES"],
  PUBLISHING: ["PUBLISHED", "FAILED"],
  PUBLISHED: [],
  FAILED: ["APPROVED", "NEEDS_CHANGES", "ADAPTING", "RESEARCHING"],
};

export class WorkflowError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INVALID_TRANSITION"
      | "HUMAN_APPROVAL_REQUIRED"
      | "SYSTEM_ONLY"
      | "NOT_PUBLISHABLE"
      | "PUBLISHING_DISABLED",
  ) {
    super(message);
    this.name = "WorkflowError";
  }
}

export function isContentState(value: unknown): value is ContentState {
  return typeof value === "string" && (CONTENT_STATES as readonly string[]).includes(value);
}

export function canTransition(from: ContentState, to: ContentState): boolean {
  return TRANSITIONS[from].includes(to);
}

/**
 * Valida una transición y quién la ejecuta. Lanza WorkflowError si no es válida.
 */
export function assertTransition(from: ContentState, to: ContentState, actor: Actor): void {
  if (!canTransition(from, to)) {
    throw new WorkflowError(
      `Transición no permitida: ${from} → ${to}`,
      "INVALID_TRANSITION",
    );
  }
  if (HUMAN_ONLY_STATES.includes(to) && actor !== "human") {
    throw new WorkflowError(
      `Solo una persona puede llevar el contenido a ${to} (actor: ${actor})`,
      "HUMAN_APPROVAL_REQUIRED",
    );
  }
  if (SYSTEM_ONLY_STATES.includes(to) && actor !== "system") {
    throw new WorkflowError(
      `Solo el sistema de publicación puede asignar ${to} (actor: ${actor})`,
      "SYSTEM_ONLY",
    );
  }
}

export function isPublishable(state: ContentState): boolean {
  return PUBLISHABLE_STATES.includes(state);
}

export function assertPublishable(state: ContentState): void {
  if (!isPublishable(state)) {
    throw new WorkflowError(
      `El PublisherAgent solo procesa registros APPROVED o SCHEDULED (estado actual: ${state})`,
      "NOT_PUBLISHABLE",
    );
  }
}

/** Etiquetas en español para la interfaz. */
export const STATE_LABELS: Record<ContentState, string> = {
  IDEA: "Idea",
  RESEARCHING: "Investigando",
  MASTER_DRAFT: "Pieza maestra",
  ADAPTING: "Adaptando",
  IN_REVIEW: "En revisión",
  NEEDS_CHANGES: "Requiere cambios",
  READY_FOR_APPROVAL: "Pendiente de aprobación",
  APPROVED: "Aprobado",
  SCHEDULED: "Programado",
  PUBLISHING: "Publicando",
  PUBLISHED: "Publicado",
  FAILED: "Fallido",
};

/** Agrupación visual del pipeline en el dashboard. */
export const STATE_GROUPS: { label: string; states: ContentState[] }[] = [
  { label: "Generación", states: ["IDEA", "RESEARCHING", "MASTER_DRAFT", "ADAPTING"] },
  { label: "Revisión", states: ["IN_REVIEW", "NEEDS_CHANGES", "READY_FOR_APPROVAL"] },
  { label: "Aprobado", states: ["APPROVED", "SCHEDULED"] },
  { label: "Publicación", states: ["PUBLISHING", "PUBLISHED", "FAILED"] },
];
