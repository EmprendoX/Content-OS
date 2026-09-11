import type { ZodType } from "zod";
import type { LLMProvider } from "@/lib/llm/provider";
import { NETWORK_SPECS, type Network } from "@/lib/networks";
import {
  AdapterInputSchema,
  AdapterOutputSchema,
  AnalyticsInputSchema,
  AnalyticsOutputSchema,
  EditorChiefInputSchema,
  EditorChiefOutputSchema,
  MasterInputSchema,
  MasterOutputSchema,
  ResearchInputSchema,
  ResearchOutputSchema,
  ReviewInputSchema,
  ReviewOutputSchema,
  StrategyInputSchema,
  StrategyOutputSchema,
  VisualBriefInputSchema,
  VisualBriefOutputSchema,
  type AdapterInput,
  type AdapterOutput,
  type AnalyticsInput,
  type AnalyticsOutput,
  type EditorChiefInput,
  type EditorChiefOutput,
  type MasterInput,
  type MasterOutput,
  type ResearchInput,
  type ResearchOutput,
  type ReviewInput,
  type ReviewOutput,
  type StrategyInput,
  type StrategyOutput,
  type VisualBriefInput,
  type VisualBriefOutput,
} from "./schemas";

/**
 * Definición de un agente: entrada y salida tipadas y validadas con Zod.
 * `run` valida la entrada, pide un objeto al proveedor y valida la salida.
 */
export interface AgentDefinition<I, O> {
  name: string;
  task: string;
  inputSchema: ZodType<I>;
  outputSchema: ZodType<O>;
  system: string;
  prompt: (input: I) => string;
  /** Post-proceso determinista (p. ej. comprobaciones de marca). */
  postProcess?: (input: I, output: O) => O;
}

export async function runAgent<I, O>(
  agent: AgentDefinition<I, O>,
  provider: LLMProvider,
  rawInput: unknown,
): Promise<O> {
  const input = agent.inputSchema.parse(rawInput);
  const output = await provider.generateObject<O>({
    task: agent.task,
    system: agent.system,
    prompt: agent.prompt(input),
    schema: agent.outputSchema,
    input,
  });
  const processed = agent.postProcess ? agent.postProcess(input, output) : output;
  return agent.outputSchema.parse(processed);
}

const BRAND_RULES = `Reglas de marca que debes respetar siempre:
- Usa la voz y tono indicados.
- No uses ninguna palabra de "forbiddenWords".
- No hagas ninguna promesa de "forbiddenPromises" ni equivalentes.
- Solo usa cifras o pruebas presentes en "proofPoints".
- Prefiere las palabras de "preferredWords".
- Escribe en español neutro salvo que la marca indique otra cosa.`;

// ---------------------------------------------------------------------------
// 1. ResearchAgent
// ---------------------------------------------------------------------------
export const ResearchAgent: AgentDefinition<ResearchInput, ResearchOutput> = {
  name: "ResearchAgent",
  task: "research",
  inputSchema: ResearchInputSchema,
  outputSchema: ResearchOutputSchema,
  system: `Eres un investigador de contenido. Analizas un tema para una marca y devuelves insights accionables, dolores de la audiencia y ángulos editoriales. Usas solo la biblioteca de conocimiento provista; si falta información, lo señalas como riesgo. ${BRAND_RULES}`,
  prompt: (input) =>
    `Investiga el tema "${input.topic}" para la marca ${input.brand.name} (campaña: ${input.campaign || "sin campaña"}, objetivo: ${input.goal || "no definido"}). Devuelve un resumen, insights clave, dolores de la audiencia, ángulos posibles, fuentes usadas y riesgos.`,
};

// ---------------------------------------------------------------------------
// 2. StrategyAgent
// ---------------------------------------------------------------------------
export const StrategyAgent: AgentDefinition<StrategyInput, StrategyOutput> = {
  name: "StrategyAgent",
  task: "strategy",
  inputSchema: StrategyInputSchema,
  outputSchema: StrategyOutputSchema,
  system: `Eres un estratega de contenidos. A partir de la investigación defines objetivo, mensaje central, ángulo y un plan por red social con formato y prioridad. ${BRAND_RULES}`,
  prompt: (input) =>
    `Define la estrategia para "${input.topic}" en las redes: ${input.networks.join(", ")}. Formatos disponibles por red: ${input.networks
      .map((n) => `${n}: ${NETWORK_SPECS[n].formats.join("/")}`)
      .join("; ")}.`,
};

// ---------------------------------------------------------------------------
// 3. MasterContentAgent
// ---------------------------------------------------------------------------
export const MasterContentAgent: AgentDefinition<MasterInput, MasterOutput> = {
  name: "MasterContentAgent",
  task: "master",
  inputSchema: MasterInputSchema,
  outputSchema: MasterOutputSchema,
  system: `Eres un redactor senior. Escribes la pieza maestra: el contenido completo y canónico del que saldrán todas las adaptaciones. Debe tener título, gancho, cuerpo estructurado, mensaje clave y CTA. ${BRAND_RULES}`,
  prompt: (input) =>
    `Escribe la pieza maestra para "${input.topic}" siguiendo el ángulo "${input.strategy.angle}" y el mensaje central "${input.strategy.coreMessage}". Entre 200 y 400 palabras. Usa listas numeradas para los puntos clave.`,
  postProcess: (_input, output) => ({
    ...output,
    wordCount: output.body.split(/\s+/).filter(Boolean).length,
  }),
};

// ---------------------------------------------------------------------------
// 4-8. Adaptadores: una definición por red
// ---------------------------------------------------------------------------
function makeAdapter(network: Network, name: string, guidance: string): AgentDefinition<AdapterInput, AdapterOutput> {
  const spec = NETWORK_SPECS[network];
  return {
    name,
    task: "adapt",
    inputSchema: AdapterInputSchema,
    outputSchema: AdapterOutputSchema,
    system: `Eres el adaptador de contenido para ${spec.label}. Reescribes la pieza maestra para esta red: no copies el texto, transfórmalo. Límite: ${spec.maxChars} caracteres. Tono: ${spec.tone}. ${guidance} ${BRAND_RULES}`,
    prompt: (input) =>
      `Adapta la pieza maestra "${input.master.title}" a ${spec.label} en formato "${input.plan.format}" con objetivo "${input.plan.objective}". Devuelve hook, copy, cta, hashtags (${spec.hashtagRange[0]}-${spec.hashtagRange[1]}) y notas de producción.`,
    postProcess: (input, output) => ({
      ...output,
      network,
      copy: network === "x" ? output.copy : output.copy.slice(0, input.constraints.maxChars),
    }),
  };
}

export const InstagramAdapter = makeAdapter(
  "instagram",
  "InstagramAdapter",
  "Prioriza carruseles y reels; frases cortas, emojis con moderación, CTA hacia el link en bio.",
);
export const FacebookAdapter = makeAdapter(
  "facebook",
  "FacebookAdapter",
  "Tono de comunidad; invita a comentar y compartir; puede ser más largo y narrativo.",
);
export const LinkedInAdapter = makeAdapter(
  "linkedin",
  "LinkedInAdapter",
  "Profesional, con aprendizajes y datos; sin enlaces en el cuerpo; cierra con pregunta.",
);
export const XAdapter = makeAdapter(
  "x",
  "XAdapter",
  "Hilo de 3 a 6 posts separados por línea en blanco; cada post ≤ 280 caracteres; sin hashtags o máximo 2.",
);
export const YouTubeAdapter = makeAdapter(
  "youtube",
  "YouTubeAdapter",
  "Guion con gancho en 3 segundos, desarrollo y cierre; incluye título y descripción del video.",
);

export const ADAPTERS: Record<Network, AgentDefinition<AdapterInput, AdapterOutput>> = {
  instagram: InstagramAdapter,
  facebook: FacebookAdapter,
  linkedin: LinkedInAdapter,
  x: XAdapter,
  youtube: YouTubeAdapter,
};

// ---------------------------------------------------------------------------
// 9. VisualBriefAgent
// ---------------------------------------------------------------------------
export const VisualBriefAgent: AgentDefinition<VisualBriefInput, VisualBriefOutput> = {
  name: "VisualBriefAgent",
  task: "visual_brief",
  inputSchema: VisualBriefInputSchema,
  outputSchema: VisualBriefOutputSchema,
  system: "Eres director de arte. Escribes un brief visual breve y ejecutable para un diseñador: concepto, formato, estilo, texto en imagen, paleta, alt text y recursos necesarios.",
  prompt: (input) =>
    `Crea el brief visual para la adaptación de ${input.adaptation.network} (formato ${input.adaptation.format}). Ratios permitidos: ${input.aspectRatios.join(", ")}.`,
};

// ---------------------------------------------------------------------------
// 10. ReviewAgent — combina LLM con comprobaciones deterministas
// ---------------------------------------------------------------------------
export const ReviewAgent: AgentDefinition<ReviewInput, ReviewOutput> = {
  name: "ReviewAgent",
  task: "review",
  inputSchema: ReviewInputSchema,
  outputSchema: ReviewOutputSchema,
  system: "Eres un revisor de calidad y cumplimiento de marca. Evalúas una adaptación y devuelves puntuación, si pasa, problemas encontrados y sugerencias. Eres estricto con palabras y promesas prohibidas.",
  prompt: (input) =>
    `Revisa la adaptación para ${input.adaptation.network}. Límite de caracteres: ${input.maxChars}.`,
  postProcess: (input, output) => {
    const text = `${input.adaptation.hook}\n${input.adaptation.copy}\n${input.adaptation.cta}`.toLowerCase();
    const issues = [...output.issues];
    for (const word of input.brand.forbiddenWords) {
      const w = word.trim().toLowerCase();
      if (w && text.includes(w) && !issues.some((i) => i.type === "palabra_prohibida" && i.message.includes(word))) {
        issues.push({ type: "palabra_prohibida", severity: "alta", message: `Contiene la palabra prohibida "${word}".` });
      }
    }
    if (input.adaptation.network !== "x" && input.adaptation.copy.length > input.maxChars) {
      if (!issues.some((i) => i.type === "longitud")) {
        issues.push({ type: "longitud", severity: "media", message: `El copy supera ${input.maxChars} caracteres.` });
      }
    }
    const hasHigh = issues.some((i) => i.severity === "alta");
    return {
      ...output,
      issues,
      passed: output.passed && !hasHigh,
      score: hasHigh ? Math.min(output.score, 40) : output.score,
    };
  },
};

// ---------------------------------------------------------------------------
// 11. EditorChiefAgent — recomienda, nunca aprueba
// ---------------------------------------------------------------------------
export const EditorChiefAgent: AgentDefinition<EditorChiefInput, EditorChiefOutput> = {
  name: "EditorChiefAgent",
  task: "editor_chief",
  inputSchema: EditorChiefInputSchema,
  outputSchema: EditorChiefOutputSchema,
  system: "Eres el editor jefe. Con las revisiones de cada adaptación decides si el conjunto pasa a aprobación humana (READY_FOR_APPROVAL) o vuelve a cambios (NEEDS_CHANGES). No tienes autoridad para aprobar: la aprobación final es siempre humana.",
  prompt: (input) =>
    `Evalúa las ${input.variants.length} adaptaciones de "${input.topic}" y decide por variante y en conjunto.`,
  postProcess: (input, output) => {
    // Garantía determinista: una variante con revisión fallida nunca pasa.
    const perVariant = input.variants.map((v) => {
      const decision = output.perVariant.find((d) => d.variantId === v.variantId);
      const forced = !v.review.passed ? ("NEEDS_CHANGES" as const) : decision?.decision ?? "NEEDS_CHANGES";
      return {
        variantId: v.variantId,
        decision: forced,
        comments: decision?.comments ?? (v.review.passed ? "" : v.review.issues.map((i) => i.message).join(" ")),
      };
    });
    return {
      ...output,
      perVariant,
      overallDecision: perVariant.every((v) => v.decision === "READY_FOR_APPROVAL") ? "READY_FOR_APPROVAL" : "NEEDS_CHANGES",
    };
  },
};

// ---------------------------------------------------------------------------
// 13. AnalyticsAgent
// ---------------------------------------------------------------------------
export const AnalyticsAgent: AgentDefinition<AnalyticsInput, AnalyticsOutput> = {
  name: "AnalyticsAgent",
  task: "analytics",
  inputSchema: AnalyticsInputSchema,
  outputSchema: AnalyticsOutputSchema,
  system: "Eres analista de contenido. Con métricas de publicaciones extraes qué funcionó, aprendizajes, recomendaciones y nuevas ideas. No inventes datos que no estén en la entrada.",
  prompt: (input) => `Analiza ${input.metrics.length} publicaciones de ${input.brand.name}.`,
};

/** Lista completa para la interfaz y la documentación. El 12 (Publisher) es determinista. */
export const AGENT_CATALOG = [
  { name: "ResearchAgent", role: "Investiga el tema con la biblioteca de conocimiento." },
  { name: "StrategyAgent", role: "Define objetivo, mensaje y plan por red." },
  { name: "MasterContentAgent", role: "Escribe la pieza maestra." },
  { name: "InstagramAdapter", role: "Adapta a Instagram." },
  { name: "FacebookAdapter", role: "Adapta a Facebook." },
  { name: "LinkedInAdapter", role: "Adapta a LinkedIn." },
  { name: "XAdapter", role: "Adapta a X (hilos)." },
  { name: "YouTubeAdapter", role: "Adapta a YouTube (guion)." },
  { name: "VisualBriefAgent", role: "Brief visual por adaptación." },
  { name: "ReviewAgent", role: "Revisión de calidad y cumplimiento." },
  { name: "EditorChiefAgent", role: "Recomienda pasar a aprobación humana o pedir cambios." },
  { name: "PublisherAgent", role: "Publica solo APPROVED/SCHEDULED. Sin IA." },
  { name: "AnalyticsAgent", role: "Analiza resultados y sugiere ideas." },
] as const;
