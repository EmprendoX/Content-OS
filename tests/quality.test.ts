import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { contentVariants } from "@/lib/db/schema";
import { regenerateVariant, runPipeline } from "@/lib/agents/orchestrator";
import { ReviewAgent, runAgent } from "@/lib/agents/agents";
import { MockProvider } from "@/lib/llm/mock";
import { generateWithRetry, type GenerateObjectRequest, type LLMProvider } from "@/lib/llm/provider";
import { transitionVariant } from "@/lib/workflow/transitions";
import { makePiece, mockDeps, seedBrand, testDb } from "./helpers";

/** Proveedor espía: delega en el mock pero guarda cada petición. */
class SpyProvider implements LLMProvider {
  readonly name = "spy";
  readonly model = "spy";
  readonly requests: GenerateObjectRequest<unknown>[] = [];
  private readonly inner = new MockProvider();
  generateObject<T>(request: GenerateObjectRequest<T>): Promise<T> {
    this.requests.push(request as GenerateObjectRequest<unknown>);
    return this.inner.generateObject(request);
  }
}

describe("calidad de contenido (fase 2)", () => {
  let db: Db;
  let brandId: string;

  beforeEach(() => {
    db = testDb();
    brandId = seedBrand(db, { networks: ["linkedin"] });
  });

  it("los prompts incluyen el brief de marca, las reglas de estilo y el playbook de la red", async () => {
    const spy = new SpyProvider();
    const piece = makePiece(db, brandId, ["linkedin"]);
    await runPipeline(piece.id, { db, provider: spy, actorLabel: "test" });
    const adapt = spy.requests.find((r) => r.task === "adapt")!;
    expect(adapt.system).toContain("# LinkedIn");
    expect(adapt.system).toContain("Cómo debe sonar el texto");
    expect(adapt.prompt).toContain("PALABRAS PROHIBIDAS");
    expect(adapt.prompt).toContain("milagro");
    expect(adapt.prompt).toContain("Pieza maestra");
    const master = spy.requests.find((r) => r.task === "master")!;
    expect(master.prompt).toContain("Lo que hay que contar");
  });

  it("al regenerar, los comentarios del revisor y el intento anterior llegan al adaptador", async () => {
    const piece = makePiece(db, brandId, ["linkedin"]);
    await runPipeline(piece.id, mockDeps(db));
    const variant = db.select().from(contentVariants).where(eq(contentVariants.pieceId, piece.id)).get()!;
    transitionVariant(db, variant.id, "NEEDS_CHANGES", "human", "test", {
      reviewerComments: "Empieza con el error concreto, no con la teoría.",
    });

    const spy = new SpyProvider();
    await regenerateVariant(variant.id, { db, provider: spy, actorLabel: "test" });
    const adapt = spy.requests.find((r) => r.task === "adapt")!;
    const input = adapt.input as { feedback: { reviewerComments: string; previousAttempt: string } };
    expect(input.feedback.reviewerComments).toBe("Empieza con el error concreto, no con la teoría.");
    expect(input.feedback.previousAttempt).toContain(variant.hook);
    expect(adapt.prompt).toContain("Feedback del revisor humano");
    expect(adapt.prompt).toContain("no con la teoría");
  });

  it("el ReviewAgent penaliza frases genéricas, hooks largos y hashtags fuera de rango", async () => {
    const brand = {
      id: brandId,
      name: "Marca Test",
      description: "",
      products: [],
      audiences: [],
      voiceTone: "",
      offers: [],
      ctas: [],
      proofPoints: [],
      preferredWords: [],
      forbiddenWords: [],
      forbiddenPromises: [],
      approvedExamples: [],
    };
    const review = await runAgent(ReviewAgent, new MockProvider(), {
      brand,
      maxChars: 3000,
      adaptation: {
        network: "linkedin",
        format: "publicación",
        hook: "En el mundo actual es importante destacar que hoy en día todo cambia muy rápido y hay que adaptarse",
        copy: "En la era digital, lleva tu negocio al siguiente nivel.\n\nTexto.",
        cta: "Escríbenos",
        hashtags: [],
        notes: "",
      },
    });
    const messages = review.issues.map((i) => i.message).join(" ");
    expect(messages).toMatch(/mundo actual/);
    expect(messages).toMatch(/siguiente nivel/);
    expect(messages).toMatch(/hook tiene/);
    expect(messages).toMatch(/hashtags/);
    expect(review.passed).toBe(false);
    expect(review.score).toBeLessThanOrEqual(65);
  });

  it("el ReviewAgent detecta promesas prohibidas de forma determinista", async () => {
    const review = await runAgent(ReviewAgent, new MockProvider(), {
      brand: {
        id: brandId,
        name: "Marca Test",
        description: "",
        products: [],
        audiences: [],
        voiceTone: "",
        offers: [],
        ctas: [],
        proofPoints: [],
        preferredWords: [],
        forbiddenWords: [],
        forbiddenPromises: ["resultados garantizados"],
        approvedExamples: [],
      },
      maxChars: 3000,
      adaptation: {
        network: "linkedin",
        format: "publicación",
        hook: "Un método con resultados garantizados",
        copy: "Texto claro y concreto.",
        cta: "Escríbenos",
        hashtags: ["#a", "#b"],
        notes: "",
      },
    });
    expect(review.passed).toBe(false);
    expect(review.issues.some((i) => i.type === "promesa_prohibida" && i.severity === "alta")).toBe(true);
    expect(review.score).toBeLessThanOrEqual(40);
  });

  it("el umbral de paso es determinista: sin altos, menos de tres medios y puntuación ≥ 75", async () => {
    const brand = {
      id: brandId, name: "Marca Test", description: "", products: [], audiences: [], voiceTone: "", offers: [], ctas: [],
      proofPoints: [], preferredWords: [], forbiddenWords: [], forbiddenPromises: [], approvedExamples: [],
    };
    const clean = await runAgent(ReviewAgent, new MockProvider(), {
      brand,
      maxChars: 3000,
      adaptation: { network: "linkedin", format: "publicación", hook: "Tu web pierde clientes en cinco segundos.", copy: "Texto concreto.", cta: "Escríbenos", hashtags: ["#a", "#b"], notes: "" },
    });
    expect(clean.passed).toBe(true);
    expect(clean.score).toBeGreaterThanOrEqual(75);
  });

  it("al volver a revisar tras regenerar, el revisor recibe el feedback ya aplicado", async () => {
    const piece = makePiece(db, brandId, ["linkedin"]);
    await runPipeline(piece.id, mockDeps(db));
    const variant = db.select().from(contentVariants).where(eq(contentVariants.pieceId, piece.id)).get()!;
    transitionVariant(db, variant.id, "NEEDS_CHANGES", "human", "test", { reviewerComments: "Cambia el hook por uno con dato." });
    const spy = new SpyProvider();
    await regenerateVariant(variant.id, { db, provider: spy, actorLabel: "test" });
    const review = spy.requests.find((r) => r.task === "review")!;
    expect((review.input as { appliedFeedback: string }).appliedFeedback).toBe("Cambia el hook por uno con dato.");
    expect(review.prompt).toContain("YA aplicó");
  });

  it("el ReviewAgent detecta el estilo telegráfico que suena a IA", async () => {
    const brand = {
      id: brandId, name: "Marca Test", description: "", products: [], audiences: [], voiceTone: "", offers: [], ctas: [],
      proofPoints: [], preferredWords: [], forbiddenWords: [], forbiddenPromises: [], approvedExamples: [],
    };
    const review = await runAgent(ReviewAgent, new MockProvider(), {
      brand,
      maxChars: 3000,
      adaptation: {
        network: "linkedin",
        format: "publicación",
        hook: "Tu página pierde clientes en cinco segundos.",
        copy: "Tu página pierde clientes en cinco segundos.\n\nError 1: hablas de ti.\nSolución: un botón principal.\nResultado: más consultas.\n\n→ Revisa la carga · Reduce el menú",
        cta: "Escríbenos",
        hashtags: ["#a", "#b"],
        notes: "",
      },
    });
    const robotic = review.issues.find((i) => i.type === "tono" && i.message.includes("telegráfico"));
    expect(robotic).toBeDefined();
    expect(robotic!.severity).toBe("alta");
    expect(review.passed).toBe(false);

    // El mismo contenido hilado en frases completas pasa.
    const fluent = await runAgent(ReviewAgent, new MockProvider(), {
      brand,
      maxChars: 3000,
      adaptation: {
        network: "linkedin",
        format: "publicación",
        hook: "Tu página pierde clientes en cinco segundos.",
        copy: "Tu página pierde clientes en cinco segundos.\n\nLo vemos cada semana: alguien entra desde el celular, no entiende qué haces y se va. No es cuestión de diseño, es que la página habla de ti y no de lo que resuelves.\n\nSi quieres, la revisamos juntos.",
        cta: "Si quieres, la revisamos juntos.",
        hashtags: ["#a", "#b"],
        notes: "",
      },
    });
    expect(fluent.passed).toBe(true);
  });

  it("el brief de marca incluye la guía del dialecto configurado", async () => {
    const spy = new SpyProvider();
    const piece = makePiece(db, brandId, ["linkedin"]);
    await runPipeline(piece.id, { db, provider: spy, actorLabel: "test" });
    const master = spy.requests.find((r) => r.task === "master")!;
    expect(master.prompt).toContain("español de México");
    expect(master.prompt).toContain("Textos reales de la marca");
    expect(master.system).toContain("suene a IA");
  });

  it("si un post de X excede el límite, el orquestador pide una corrección de longitud antes de revisar", async () => {
    const longPost = `2/ ${"palabra ".repeat(60)}`.trim(); // > 280 caracteres
    let adaptCalls = 0;
    const inner = new MockProvider();
    const provider: LLMProvider = {
      name: "spy",
      model: "spy",
      async generateObject<T>(request: GenerateObjectRequest<T>): Promise<T> {
        const result = await inner.generateObject(request);
        if (request.task !== "adapt") return result;
        adaptCalls += 1;
        const feedback = (request.input as { feedback?: { reviewerComments: string } }).feedback;
        if (adaptCalls === 1) {
          expect(feedback).toBeFalsy();
          return { ...(result as object), copy: `1/ Hook corto.\n\n${longPost}\n\n3/ Cierre.` } as T;
        }
        expect(feedback?.reviewerComments).toMatch(/post 2 tiene/);
        return result;
      },
    };
    const xBrand = seedBrand(db, { networks: ["x"] });
    const piece = makePiece(db, xBrand, ["x"]);
    const result = await runPipeline(piece.id, { db, provider, actorLabel: "test" });
    expect(adaptCalls).toBe(2);
    const variant = db.select().from(contentVariants).where(eq(contentVariants.pieceId, piece.id)).get()!;
    for (const post of variant.copy.split(/\n\s*\n/)) expect(post.length).toBeLessThanOrEqual(280);
    expect(result.status).toBe("READY_FOR_APPROVAL");
  });

  it("generateWithRetry reintenta una vez con los errores de validación y luego falla", async () => {
    const schema = z.object({ ok: z.boolean(), greeting: z.string() });
    const calls: string[] = [];
    const request = { task: "ping", system: "s", prompt: "p", schema, input: {} };

    const fixedOnRetry = await generateWithRetry("fake", request, async (_system, prompt) => {
      calls.push(prompt);
      return calls.length === 1 ? '```json\n{"ok": "sí"}\n```' : '{"ok": true, "greeting": "hola"}';
    });
    expect(fixedOnRetry).toEqual({ ok: true, greeting: "hola" });
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain("Corrección");

    await expect(generateWithRetry("fake", request, async () => "esto no es json")).rejects.toThrow(/no cumple el esquema/);
  });
});
