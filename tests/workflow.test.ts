import { describe, expect, it } from "vitest";
import {
  CONTENT_STATES,
  TRANSITIONS,
  WorkflowError,
  assertPublishable,
  assertTransition,
  canTransition,
} from "@/lib/workflow/states";
import { EditorChiefOutputSchema } from "@/lib/agents/schemas";

describe("máquina de estados", () => {
  it("define transiciones para los 12 estados", () => {
    expect(CONTENT_STATES).toHaveLength(12);
    for (const state of CONTENT_STATES) {
      expect(TRANSITIONS[state]).toBeDefined();
    }
  });

  it("acepta el camino feliz completo", () => {
    const path = [
      "IDEA",
      "RESEARCHING",
      "MASTER_DRAFT",
      "ADAPTING",
      "IN_REVIEW",
      "READY_FOR_APPROVAL",
      "APPROVED",
      "SCHEDULED",
      "PUBLISHING",
      "PUBLISHED",
    ] as const;
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i], path[i + 1])).toBe(true);
    }
  });

  it("rechaza saltos inválidos", () => {
    expect(canTransition("IDEA", "APPROVED")).toBe(false);
    expect(canTransition("IN_REVIEW", "PUBLISHED")).toBe(false);
    expect(canTransition("PUBLISHED", "IDEA")).toBe(false);
    expect(() => assertTransition("IDEA", "PUBLISHED", "human")).toThrow(WorkflowError);
  });

  it("solo un humano puede aprobar o programar", () => {
    expect(() => assertTransition("READY_FOR_APPROVAL", "APPROVED", "agent")).toThrowError(
      /Solo una persona/,
    );
    expect(() => assertTransition("READY_FOR_APPROVAL", "APPROVED", "system")).toThrow(WorkflowError);
    expect(() => assertTransition("APPROVED", "SCHEDULED", "agent")).toThrow(WorkflowError);
    expect(() => assertTransition("READY_FOR_APPROVAL", "APPROVED", "human")).not.toThrow();
    expect(() => assertTransition("APPROVED", "SCHEDULED", "human")).not.toThrow();
  });

  it("solo el sistema puede marcar PUBLISHING/PUBLISHED", () => {
    expect(() => assertTransition("APPROVED", "PUBLISHING", "human")).toThrow(WorkflowError);
    expect(() => assertTransition("PUBLISHING", "PUBLISHED", "agent")).toThrow(WorkflowError);
    expect(() => assertTransition("APPROVED", "PUBLISHING", "system")).not.toThrow();
  });

  it("solo APPROVED y SCHEDULED son publicables", () => {
    for (const state of CONTENT_STATES) {
      if (state === "APPROVED" || state === "SCHEDULED") {
        expect(() => assertPublishable(state)).not.toThrow();
      } else {
        expect(() => assertPublishable(state)).toThrow(WorkflowError);
      }
    }
  });

  it("el esquema del EditorChief no admite APPROVED como decisión", () => {
    const result = EditorChiefOutputSchema.safeParse({
      summary: "x",
      overallDecision: "APPROVED",
      perVariant: [],
    });
    expect(result.success).toBe(false);
  });
});
