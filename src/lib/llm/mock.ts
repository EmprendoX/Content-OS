import type { GenerateObjectRequest, LLMProvider } from "./provider";
import { LLMError } from "./provider";
import type {
  AdapterInput,
  AdapterOutput,
  AnalyticsInput,
  AnalyticsOutput,
  EditorChiefInput,
  EditorChiefOutput,
  MasterInput,
  MasterOutput,
  ResearchInput,
  ResearchOutput,
  ReviewInput,
  ReviewOutput,
  StrategyInput,
  StrategyOutput,
  VisualBriefInput,
  VisualBriefOutput,
} from "@/lib/agents/schemas";
import { NETWORK_SPECS } from "@/lib/networks";

/**
 * MockProvider: genera salidas deterministas y plausibles sin llamar a ninguna
 * API. Sirve para desarrollo, demos y tests. Cada salida pasa igualmente por
 * la validación Zod del agente.
 */

const pick = <T>(arr: T[], fallback: T): T => (arr.length > 0 ? arr[0] : fallback);

function firstSentence(text: string, max = 90): string {
  const sentence = text.split(/[.!?]\s/)[0] ?? text;
  return sentence.length > max ? `${sentence.slice(0, max - 1)}…` : sentence;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

const handlers: Record<string, (input: unknown) => unknown> = {
  ping() {
    return { ok: true, greeting: "MockProvider operativo." };
  },

  research(raw): ResearchOutput {
    const input = raw as ResearchInput;
    const audience = pick(input.brand.audiences, "tu audiencia");
    const product = pick(input.brand.products, "el producto");
    return {
      summary: `${input.topic}: la audiencia (${audience}) busca resultados concretos y desconfía de promesas vagas. ${input.brand.name} puede diferenciarse mostrando el proceso y datos reales de ${product}.`,
      keyInsights: [
        `El interés por "${input.topic}" crece cuando se explica con ejemplos prácticos.`,
        `Los formatos con estructura (pasos, antes/después, checklist) retienen más atención.`,
        `Las pruebas verificables (${pick(input.brand.proofPoints, "casos reales")}) aumentan la credibilidad.`,
      ],
      audiencePains: [
        `No sabe por dónde empezar con ${input.topic}.`,
        "Ha probado soluciones genéricas que no se adaptaron a su caso.",
        "Tiene poco tiempo y necesita respuestas accionables.",
      ],
      angles: [
        `El error más común al abordar ${input.topic} (y cómo evitarlo)`,
        `Cómo ${input.brand.name} resuelve ${input.topic} en 3 pasos`,
        `Lo que nadie te cuenta sobre ${input.topic}`,
      ],
      sources: input.knowledge.slice(0, 3).map((k) => ({
        title: k.title,
        note: `Usado como referencia interna (${k.type}).`,
      })),
      risks: [
        "Evitar cifras no autorizadas.",
        ...(input.brand.forbiddenPromises.length > 0
          ? [`No prometer: ${input.brand.forbiddenPromises[0]}.`]
          : []),
      ],
    };
  },

  strategy(raw): StrategyOutput {
    const input = raw as StrategyInput;
    return {
      objective: input.goal || `Generar conversaciones cualificadas sobre ${input.topic}.`,
      coreMessage: `${input.brand.name} convierte ${input.topic} en un proceso claro, medible y adaptado a ${pick(input.brand.audiences, "cada cliente")}.`,
      contentPillar: input.campaign || "Educación",
      angle: input.research.angles[0],
      keyPoints: input.research.keyInsights.slice(0, 3),
      toneNotes: input.brand.voiceTone || "Claro, directo y cercano.",
      networkPlan: input.networks.map((network, index) => ({
        network,
        format: NETWORK_SPECS[network].defaultFormat,
        objective:
          network === "linkedin"
            ? "Autoridad y captación B2B"
            : network === "x"
              ? "Alcance y conversación"
              : network === "youtube"
                ? "Profundidad y retención"
                : "Alcance y guardados",
        priority: Math.min(3, index + 1),
      })),
    };
  },

  master(raw): MasterOutput {
    const input = raw as MasterInput;
    const cta = pick(input.brand.ctas, "Escríbenos y lo vemos juntos.");
    const proof = input.brand.proofPoints.slice(0, 2);
    const body = [
      `${input.strategy.coreMessage}`,
      "",
      `1. ${input.strategy.keyPoints[0] ?? "Empieza por el problema real."}`,
      `2. ${input.strategy.keyPoints[1] ?? "Muestra el proceso, no solo el resultado."}`,
      `3. ${input.strategy.keyPoints[2] ?? "Cierra con una acción concreta."}`,
      "",
      proof.length > 0 ? `Lo respaldan datos: ${proof.join(" · ")}.` : "",
      "",
      cta,
    ]
      .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
      .join("\n");
    return {
      title: input.strategy.angle,
      hook: `${firstSentence(input.strategy.angle)}: esto es lo que aprendimos en ${input.brand.name}.`,
      body,
      keyMessage: input.strategy.coreMessage,
      cta,
      proofPointsUsed: proof,
      wordCount: body.split(/\s+/).filter(Boolean).length,
    };
  },

  adapt(raw): AdapterOutput {
    const input = raw as AdapterInput;
    const { network, master, constraints, plan, brand } = input;
    const tag = (s: string) =>
      `#${s
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "")}`;
    const baseTags = [tag(brand.name), tag(master.title.split(" ").slice(0, 2).join(""))];

    switch (network) {
      case "instagram": {
        const copy = [
          master.hook,
          "",
          "Desliza 👉",
          "",
          ...master.body.split("\n").filter((l) => /^\d\./.test(l)).map((l) => l.replace(/^\d\.\s*/, "✅ ")),
          "",
          "Guarda este post para cuando lo necesites.",
        ].join("\n");
        return {
          network,
          format: plan.format,
          hook: master.hook,
          copy: truncate(copy, constraints.maxChars),
          cta: `${master.cta} Link en bio.`,
          hashtags: [...baseTags, "#marketing", "#estrategia"],
          notes: "Carrusel de 5 slides: portada con el hook, 3 puntos, cierre con CTA.",
        };
      }
      case "facebook": {
        const copy = `${master.hook}\n\n${master.body}\n\n¿Te ha pasado? Cuéntanos en comentarios.`;
        return {
          network,
          format: plan.format,
          hook: master.hook,
          copy: truncate(copy, constraints.maxChars),
          cta: master.cta,
          hashtags: baseTags.slice(0, 1),
          notes: "Tono de comunidad; incluir imagen con el hook.",
        };
      }
      case "linkedin": {
        const copy = [
          master.hook,
          "",
          `Contexto: ${master.keyMessage}`,
          "",
          ...master.body.split("\n").filter((l) => /^\d\./.test(l)).map((l) => `→ ${l.replace(/^\d\.\s*/, "")}`),
          "",
          master.proofPointsUsed.length > 0 ? `Dato: ${master.proofPointsUsed[0]}.` : "",
          "",
          "¿Qué añadirías desde tu experiencia?",
        ]
          .filter((l, i, arr) => !(l === "" && arr[i - 1] === ""))
          .join("\n");
        return {
          network,
          format: plan.format,
          hook: master.hook,
          copy: truncate(copy, constraints.maxChars),
          cta: master.cta,
          hashtags: [...baseTags, "#B2B"],
          notes: "Sin enlaces en el cuerpo; el enlace va en el primer comentario.",
        };
      }
      case "x": {
        const points = master.body.split("\n").filter((l) => /^\d\./.test(l));
        const thread = [
          `1/ ${truncate(master.hook, 240)}`,
          ...points.map((p, i) => `${i + 2}/ ${truncate(p.replace(/^\d\.\s*/, ""), 260)}`),
          `${points.length + 2}/ ${truncate(master.cta, 260)}`,
        ].join("\n\n");
        return {
          network,
          format: "hilo",
          hook: truncate(master.hook, 280),
          copy: thread,
          cta: truncate(master.cta, 200),
          hashtags: [],
          notes: `Hilo de ${points.length + 2} posts; cada uno respeta ${constraints.maxChars} caracteres.`,
        };
      }
      case "youtube": {
        const copy = [
          `GANCHO (0-3s): ${master.hook}`,
          "",
          `DESARROLLO: ${master.keyMessage}`,
          ...master.body.split("\n").filter((l) => /^\d\./.test(l)).map((l) => `• ${l.replace(/^\d\.\s*/, "")}`),
          "",
          `CIERRE: ${master.cta}`,
          "",
          `Descripción: ${master.title} | ${brand.name}`,
        ].join("\n");
        return {
          network,
          format: plan.format,
          hook: master.hook,
          copy: truncate(copy, constraints.maxChars),
          cta: master.cta,
          hashtags: [...baseTags, "#Shorts"],
          notes: "Guion para short vertical de 45-60 segundos con subtítulos.",
        };
      }
    }
  },

  visual_brief(raw): VisualBriefOutput {
    const input = raw as VisualBriefInput;
    return {
      concept: `Pieza limpia con el hook como titular: "${firstSentence(input.adaptation.hook, 60)}"`,
      aspectRatio: input.aspectRatios[0] ?? "1:1",
      style: "Minimalista, tipografía grande, fondo sólido de marca, un elemento gráfico.",
      textOverlay: firstSentence(input.adaptation.hook, 50),
      colorPalette: ["#0F172A", "#2563EB", "#F8FAFC"],
      altText: `Gráfico de ${input.brand.name} sobre ${firstSentence(input.adaptation.hook, 80)}`,
      assetsNeeded: ["Logo en SVG", "Foto o ilustración de apoyo (opcional)"],
    };
  },

  review(raw): ReviewOutput {
    const input = raw as ReviewInput;
    const text = `${input.adaptation.hook}\n${input.adaptation.copy}\n${input.adaptation.cta}`.toLowerCase();
    const issues: ReviewOutput["issues"] = [];
    for (const word of input.brand.forbiddenWords) {
      if (word && text.includes(word.toLowerCase())) {
        issues.push({ type: "palabra_prohibida", severity: "alta", message: `Contiene la palabra prohibida "${word}".` });
      }
    }
    for (const promise of input.brand.forbiddenPromises) {
      const key = promise.toLowerCase().split(" ").slice(0, 2).join(" ");
      if (key && text.includes(key)) {
        issues.push({ type: "promesa_prohibida", severity: "alta", message: `Se acerca a una promesa prohibida: "${promise}".` });
      }
    }
    if (input.adaptation.copy.length > input.maxChars) {
      issues.push({ type: "longitud", severity: "media", message: `El copy supera ${input.maxChars} caracteres.` });
    }
    if (!input.adaptation.cta.trim()) {
      issues.push({ type: "cta", severity: "media", message: "Falta un llamado a la acción." });
    }
    const high = issues.filter((i) => i.severity === "alta").length;
    const score = Math.max(0, 92 - high * 30 - (issues.length - high) * 10);
    return {
      score,
      passed: high === 0,
      issues,
      suggestions: [
        "Acortar el hook a menos de 12 palabras para móvil.",
        "Añadir un dato concreto en la segunda línea.",
      ],
    };
  },

  editor_chief(raw): EditorChiefOutput {
    const input = raw as EditorChiefInput;
    const perVariant = input.variants.map((v) => ({
      variantId: v.variantId,
      decision: v.review.passed ? ("READY_FOR_APPROVAL" as const) : ("NEEDS_CHANGES" as const),
      comments: v.review.passed
        ? `Cumple voz y restricciones de ${input.brand.name}. Lista para revisión humana.`
        : `Corregir: ${v.review.issues.map((i) => i.message).join(" ")}`,
    }));
    const allPass = perVariant.every((v) => v.decision === "READY_FOR_APPROVAL");
    return {
      summary: allPass
        ? `Las ${perVariant.length} adaptaciones de "${input.topic}" están listas para aprobación humana.`
        : `${perVariant.filter((v) => v.decision === "NEEDS_CHANGES").length} adaptación(es) necesitan cambios antes de pasar a aprobación.`,
      overallDecision: allPass ? "READY_FOR_APPROVAL" : "NEEDS_CHANGES",
      perVariant,
    };
  },

  analytics(raw): AnalyticsOutput {
    const input = raw as AnalyticsInput;
    const scored = input.metrics
      .map((m) => ({ ...m, engagement: m.likes + m.comments * 3 + m.shares * 4 + m.saves * 2 }))
      .sort((a, b) => b.engagement - a.engagement);
    const top = scored.slice(0, 3);
    return {
      summary:
        scored.length === 0
          ? "Aún no hay métricas suficientes para extraer conclusiones."
          : `Se analizaron ${scored.length} publicaciones de ${input.brand.name}. ${top[0].network} lidera en interacción con "${top[0].topic}".`,
      topPerformers: top.map((m) => ({
        variantId: m.variantId,
        reason: `${m.network} · ${m.format}: ${m.engagement} puntos de interacción.`,
      })),
      learnings: [
        "Los formatos con estructura numerada generan más guardados.",
        "Los hooks con pregunta directa aumentan comentarios.",
      ],
      recommendations: [
        "Repetir el ángulo del mejor contenido en un formato distinto.",
        "Programar publicaciones de LinkedIn entre martes y jueves por la mañana.",
      ],
      suggestedIdeas: top.slice(0, 2).map((m) => ({
        title: `Secuela de "${m.topic}" en ${m.network}`,
        rationale: "Aprovechar el interés demostrado con un contenido de profundidad.",
      })),
    };
  },
};

export class MockProvider implements LLMProvider {
  readonly name = "mock";
  readonly model = "mock-v1";

  async generateObject<T>(request: GenerateObjectRequest<T>): Promise<T> {
    const handler = handlers[request.task];
    if (!handler) {
      throw new LLMError(`MockProvider no tiene plantilla para la tarea "${request.task}".`, this.name);
    }
    const output = handler(request.input);
    const result = request.schema.safeParse(output);
    if (!result.success) {
      throw new LLMError(
        `Salida mock inválida para "${request.task}": ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
        this.name,
      );
    }
    return result.data;
  }
}
