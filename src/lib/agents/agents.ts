import type { ZodType } from "zod";
import type { LLMProvider } from "@/lib/llm/provider";
import { NETWORK_SPECS, type Network } from "@/lib/networks";
import { GENERIC_PHRASES, NETWORK_PLAYBOOK, STYLE_RULES, renderBrandBrief, renderNetworkConstraints } from "./prompts";
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

function feedbackBlock(feedback: MasterInput["feedback"]): string {
  if (!feedback || !feedback.reviewerComments.trim()) return "";
  return [
    "",
    "# Feedback del revisor humano (PRIORIDAD MÁXIMA)",
    `El revisor pidió cambios: «${feedback.reviewerComments.trim()}»`,
    feedback.previousAttempt
      ? `Intento anterior (NO lo repitas; cambia de verdad lo que se pide):\n"""\n${feedback.previousAttempt}\n"""`
      : "",
    "Aplica el feedback de forma visible y explica en \"notes\" qué cambiaste.",
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// 1. ResearchAgent
// ---------------------------------------------------------------------------
export const ResearchAgent: AgentDefinition<ResearchInput, ResearchOutput> = {
  name: "ResearchAgent",
  task: "research",
  inputSchema: ResearchInputSchema,
  outputSchema: ResearchOutputSchema,
  system: `Eres un investigador de contenido senior para marcas. Tu trabajo es entender un tema desde el punto de vista de la audiencia de la marca y convertirlo en material accionable para un estratega.
No tienes acceso a internet: tu única fuente externa es la biblioteca de conocimiento de la marca que recibes en la entrada. Puedes aportar conocimiento general del sector, pero marca como "riesgo" cualquier afirmación que necesite verificación.
${STYLE_RULES}`,
  prompt: (input) =>
    `${renderBrandBrief(input.brand)}

# Encargo
Tema: "${input.topic}"
Campaña: ${input.campaign || "sin campaña"}
Objetivo de negocio: ${input.goal || "no definido; asume captación de clientes"}

# Qué necesito
- summary: 3-5 frases que expliquen por qué este tema importa a ESTA audiencia ahora y qué postura debería tomar la marca.
- keyInsights: 3-5 insights concretos y no obvios (cada uno una frase con su porqué). Nada de generalidades.
- audiencePains: 3-5 dolores expresados como los diría la propia audiencia, en primera persona.
- angles: 3-5 ángulos editoriales distintos entre sí (contraintuitivo, error común, proceso paso a paso, caso, mito vs realidad...). Cada ángulo es un titular de trabajo.
- sources: qué elementos de la biblioteca usaste y para qué.
- risks: afirmaciones que no debemos hacer, cifras no autorizadas, promesas prohibidas cercanas al tema.`,
};

// ---------------------------------------------------------------------------
// 2. StrategyAgent
// ---------------------------------------------------------------------------
export const StrategyAgent: AgentDefinition<StrategyInput, StrategyOutput> = {
  name: "StrategyAgent",
  task: "strategy",
  inputSchema: StrategyInputSchema,
  outputSchema: StrategyOutputSchema,
  system: `Eres un estratega de contenidos. Conviertes una investigación en una decisión editorial clara: un objetivo, un mensaje central, un ángulo y un plan por red. Decides; no enumeras opciones.
${STYLE_RULES}`,
  prompt: (input) =>
    `${renderBrandBrief(input.brand)}

# Investigación previa
${JSON.stringify(input.research, null, 2)}

# Encargo
Tema: "${input.topic}". Campaña: ${input.campaign || "sin campaña"}. Objetivo: ${input.goal || "captación"}.
Redes a cubrir: ${input.networks.map((n) => NETWORK_SPECS[n].label).join(", ")}.
Formatos disponibles por red: ${input.networks.map((n) => `${NETWORK_SPECS[n].label}: ${NETWORK_SPECS[n].formats.join("/")}`).join("; ")}.

# Qué necesito
- objective: objetivo medible de esta pieza (qué debe hacer el lector).
- coreMessage: UNA frase que resume lo que queremos que el lector recuerde. Concreta, con la voz de la marca.
- contentPillar: pilar de contenido al que pertenece.
- angle: el ángulo elegido entre los de la investigación (o uno mejor), formulado como titular de trabajo.
- keyPoints: 3 puntos que sostienen el mensaje, cada uno con un ejemplo o consecuencia concreta.
- toneNotes: instrucciones de tono para el redactor (2-3 frases: qué sí, qué no).
- networkPlan: para cada red, formato elegido y por qué, objetivo específico en esa red y prioridad 1-3.`,
};

// ---------------------------------------------------------------------------
// 3. MasterContentAgent
// ---------------------------------------------------------------------------
export const MasterContentAgent: AgentDefinition<MasterInput, MasterOutput> = {
  name: "MasterContentAgent",
  task: "master",
  inputSchema: MasterInputSchema,
  outputSchema: MasterOutputSchema,
  system: `Eres un redactor senior de contenido para marcas. Escribes la PIEZA MAESTRA: el texto canónico y completo del que saldrán todas las adaptaciones. No es un post; es el argumento completo, bien escrito, con la voz de la marca.
${STYLE_RULES}`,
  prompt: (input) =>
    `${renderBrandBrief(input.brand)}

# Estrategia aprobada
Mensaje central: ${input.strategy.coreMessage}
Ángulo: ${input.strategy.angle}
Objetivo: ${input.strategy.objective}
Puntos clave:
${input.strategy.keyPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}
Notas de tono: ${input.strategy.toneNotes}

# Material de investigación
Insights: ${input.research.keyInsights.join(" | ")}
Dolores de la audiencia: ${input.research.audiencePains.join(" | ")}
Riesgos a evitar: ${input.research.risks.join(" | ")}
${feedbackBlock(input.feedback)}

# Qué necesito
- title: título de trabajo de la pieza (no es el hook).
- hook: primera frase, máximo 15 palabras, específica y con tensión. Debe funcionar sola. Prohibido empezar con pregunta retórica vacía o con "¿Sabías que".
- body: 250-450 palabras. Estructura: apertura que amplía el hook con una situación concreta (2-3 frases) → desarrollo con los 3 puntos clave, cada uno con subtítulo corto en su propia línea y 2-4 frases con ejemplo → cierre que devuelve al mensaje central. Usa saltos de línea dobles entre bloques. Sin markdown de encabezados (#), sin negritas.
- keyMessage: el mensaje central tal como quedó expresado en el texto.
- cta: una llamada a la acción tomada de las permitidas de la marca (o una variación muy cercana).
- proofPointsUsed: qué pruebas autorizadas usaste (solo las que aparecen en el brief).
- wordCount: número de palabras del body.`,
  postProcess: (_input, output) => ({
    ...output,
    wordCount: output.body.split(/\s+/).filter(Boolean).length,
  }),
};

// ---------------------------------------------------------------------------
// 4-8. Adaptadores: una definición por red
// ---------------------------------------------------------------------------
function makeAdapter(network: Network, name: string): AgentDefinition<AdapterInput, AdapterOutput> {
  const spec = NETWORK_SPECS[network];
  return {
    name,
    task: "adapt",
    inputSchema: AdapterInputSchema,
    outputSchema: AdapterOutputSchema,
    system: `Eres el editor de ${spec.label} de una marca. Recibes una pieza maestra y la REESCRIBES para ${spec.label}: mismo mensaje central, pero estructura, longitud, ritmo y gancho nativos de esta red. Adaptar no es recortar: es volver a escribir pensando en cómo se consume aquí.
${NETWORK_PLAYBOOK[network]}
${STYLE_RULES}`,
    prompt: (input) =>
      `${renderBrandBrief(input.brand)}

# Pieza maestra
Título: ${input.master.title}
Hook maestro: ${input.master.hook}
Mensaje clave: ${input.master.keyMessage}
CTA: ${input.master.cta}
Pruebas usadas: ${input.master.proofPointsUsed.join(" | ") || "ninguna"}
Cuerpo:
"""
${input.master.body}
"""

# Plan para esta red
Formato: ${input.plan.format}. Objetivo en ${spec.label}: ${input.plan.objective}. Prioridad: ${input.plan.priority}.
${renderNetworkConstraints(network)}
${feedbackBlock(input.feedback)}

# Qué necesito
- network: "${network}".
- format: el formato usado (uno de los válidos).
- hook: la primera línea tal como aparecerá (máximo 12 palabras). Debe ser distinta del hook maestro: reescrita para esta red.
- copy: el contenido completo listo para publicar, con los saltos de línea reales. Sin el bloque de hashtags dentro (van aparte). Respeta el límite de caracteres.
- cta: la llamada a la acción tal como aparece al final del copy.
- hashtags: lista con "#", dentro del rango permitido, específicos del tema.
- notes: indicaciones de producción (slides, plano, texto en pantalla, enlace en comentario) y, si hubo feedback, qué cambiaste.`,
    postProcess: (input, output) => ({
      ...output,
      network,
      hashtags: output.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).filter((h) => h.length > 1),
      copy: network === "x" ? output.copy : output.copy.slice(0, input.constraints.maxChars),
    }),
  };
}

export const InstagramAdapter = makeAdapter("instagram", "InstagramAdapter");
export const FacebookAdapter = makeAdapter("facebook", "FacebookAdapter");
export const LinkedInAdapter = makeAdapter("linkedin", "LinkedInAdapter");
export const XAdapter = makeAdapter("x", "XAdapter");
export const YouTubeAdapter = makeAdapter("youtube", "YouTubeAdapter");

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
  system: `Eres director de arte para redes sociales. Escribes briefs breves y ejecutables para un diseñador o para una herramienta de generación de imágenes. Piensa en legibilidad en móvil y en coherencia con la marca. Sin adjetivos vacíos: instrucciones concretas.`,
  prompt: (input) =>
    `Marca: ${input.brand.name}. Voz: ${input.brand.voiceTone || "clara y directa"}.
Red: ${input.adaptation.network}. Formato: ${input.adaptation.format}.
Hook del copy: ${input.adaptation.hook}
Notas de producción del editor: ${input.adaptation.notes || "ninguna"}
Ratios permitidos: ${input.aspectRatios.join(", ")}.

Qué necesito:
- concept: una frase que describa la imagen o secuencia (qué se ve, qué comunica).
- aspectRatio: uno de los permitidos, el más adecuado al formato.
- style: estilo visual concreto (tipografía, composición, fotografía o ilustración, fondo).
- textOverlay: el texto que va sobre la imagen (máximo 8 palabras; puede ser el hook recortado).
- colorPalette: 2-4 colores en hexadecimal coherentes con una marca ${input.brand.voiceTone.toLowerCase().includes("sobri") ? "sobria" : "moderna"}.
- altText: descripción accesible de la imagen en una frase.
- assetsNeeded: recursos que hay que tener (logo, foto de producto, captura, icono...).`,
};

// ---------------------------------------------------------------------------
// 10. ReviewAgent — combina LLM con comprobaciones deterministas
// ---------------------------------------------------------------------------
export const ReviewAgent: AgentDefinition<ReviewInput, ReviewOutput> = {
  name: "ReviewAgent",
  task: "review",
  inputSchema: ReviewInputSchema,
  outputSchema: ReviewOutputSchema,
  system: `Eres un revisor de calidad y cumplimiento de marca, exigente y concreto. Evalúas una adaptación lista para publicar y devuelves una puntuación 0-100, si pasa o no, los problemas encontrados y sugerencias accionables.
Rúbrica (100 puntos):
- Cumplimiento de marca (30): sin palabras ni promesas prohibidas, solo pruebas autorizadas, CTA permitido.
- Hook (20): específico, con tensión, funciona solo, ≤ 12 palabras.
- Claridad y concreción (20): un mensaje, ejemplos reales, sin frases genéricas ni relleno.
- Adecuación a la red (20): estructura, longitud, ritmo y hashtags nativos de la red.
- Voz de marca (10): suena a esta marca y no a cualquier otra.
Un problema de severidad "alta" implica passed=false. Una frase genérica o un hook flojo es severidad "media". No apruebes por cortesía: el 60 % del contenido que recibes no debería pasar a la primera.
Las pruebas autorizadas pueden parafrasearse: solo es problema si cambia la cifra o el sentido. No penalices la redacción de una prueba si el dato es el mismo.
Reserva las severidades "media" para problemas que un lector notaría; los matices de estilo son "baja".
Las sugerencias deben ser reescrituras concretas ("cambia X por Y"), no consejos vagos.`,
  prompt: (input) =>
    `${renderBrandBrief(input.brand)}

# Adaptación a revisar (${input.adaptation.network}, formato ${input.adaptation.format})
Hook: ${input.adaptation.hook}
Copy:
"""
${input.adaptation.copy}
"""
CTA: ${input.adaptation.cta}
Hashtags: ${input.adaptation.hashtags.join(" ") || "ninguno"}
Límite de caracteres: ${input.maxChars}. Longitud actual: ${input.adaptation.copy.length}.
${NETWORK_PLAYBOOK[input.adaptation.network]}`,
  postProcess: (input, output) => {
    const text = `${input.adaptation.hook}\n${input.adaptation.copy}\n${input.adaptation.cta}`.toLowerCase();
    const issues = [...output.issues];
    const has = (type: ReviewOutput["issues"][number]["type"], needle?: string) =>
      issues.some((i) => i.type === type && (!needle || i.message.toLowerCase().includes(needle.toLowerCase())));

    for (const word of input.brand.forbiddenWords) {
      const w = word.trim().toLowerCase();
      if (w && text.includes(w) && !has("palabra_prohibida", word)) {
        issues.push({ type: "palabra_prohibida", severity: "alta", message: `Contiene la palabra prohibida "${word}".` });
      }
    }
    for (const promise of input.brand.forbiddenPromises) {
      const p = promise.trim().toLowerCase();
      if (p && text.includes(p) && !has("promesa_prohibida", promise)) {
        issues.push({ type: "promesa_prohibida", severity: "alta", message: `Contiene la promesa prohibida "${promise}".` });
      }
    }
    for (const phrase of GENERIC_PHRASES) {
      if (text.includes(phrase) && !has("claridad", phrase)) {
        issues.push({ type: "claridad", severity: "media", message: `Frase genérica: "${phrase}". Sustitúyela por algo concreto.` });
      }
    }
    const spec = NETWORK_SPECS[input.adaptation.network];
    if (input.adaptation.network === "x") {
      input.adaptation.copy.split(/\n\s*\n/).forEach((post, i) => {
        if (post.length > spec.maxChars && !has("longitud", `post ${i + 1}`)) {
          issues.push({ type: "longitud", severity: "alta", message: `El post ${i + 1} del hilo tiene ${post.length} caracteres (máximo ${spec.maxChars}).` });
        }
      });
    } else if (input.adaptation.copy.length > input.maxChars && !has("longitud")) {
      issues.push({ type: "longitud", severity: "alta", message: `El copy tiene ${input.adaptation.copy.length} caracteres (máximo ${input.maxChars}).` });
    }
    const [minTags, maxTags] = spec.hashtagRange;
    const tagCount = input.adaptation.hashtags.length;
    if ((tagCount < minTags || tagCount > maxTags) && !has("otro", "hashtag")) {
      issues.push({ type: "otro", severity: "baja", message: `Hay ${tagCount} hashtags; en ${spec.label} se recomiendan entre ${minTags} y ${maxTags}.` });
    }
    const hookWords = input.adaptation.hook.trim().split(/\s+/).length;
    if (hookWords > 16 && !has("claridad", "hook")) {
      issues.push({ type: "claridad", severity: "media", message: `El hook tiene ${hookWords} palabras; acórtalo a 12 o menos.` });
    }
    const emojiCount = (input.adaptation.copy.match(/\p{Extended_Pictographic}/gu) ?? []).length;
    if (emojiCount > 8 && !has("tono", "emoji")) {
      issues.push({ type: "tono", severity: "media", message: `Hay ${emojiCount} emojis; reduce a un máximo de 1 por bloque.` });
    }
    if (!input.adaptation.cta.trim() && !has("cta")) {
      issues.push({ type: "cta", severity: "media", message: "Falta un llamado a la acción." });
    }

    const hasHigh = issues.some((i) => i.severity === "alta");
    const mediumCount = issues.filter((i) => i.severity === "media").length;
    const cappedScore = Math.min(output.score, hasHigh ? 40 : mediumCount >= 3 ? 65 : 100);
    return {
      ...output,
      issues,
      passed: output.passed && !hasHigh && mediumCount < 3,
      score: cappedScore,
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
  system: `Eres el editor jefe. Recibes las adaptaciones de una pieza con su revisión y decides, por variante y en conjunto, si pasan a aprobación humana (READY_FOR_APPROVAL) o vuelven a cambios (NEEDS_CHANGES). No tienes autoridad para aprobar: la aprobación final es siempre de una persona.
Tus comentarios por variante son la guía que recibirá el redactor si se regenera: sé concreto (qué frase, qué cambio). Si una variante pasa, di en una frase por qué funciona.`,
  prompt: (input) =>
    `Marca: ${input.brand.name}. Tema: "${input.topic}".

${input.variants
  .map(
    (v) => `## Variante ${v.variantId} (${v.network}, ${v.adaptation.format})
Hook: ${v.adaptation.hook}
Copy (primeras líneas): ${v.adaptation.copy.slice(0, 400)}
Revisión: ${v.review.score}/100, ${v.review.passed ? "pasa" : "no pasa"}.
Problemas: ${v.review.issues.map((i) => `[${i.severity}] ${i.message}`).join(" | ") || "ninguno"}
Sugerencias: ${v.review.suggestions.join(" | ") || "ninguna"}`,
  )
  .join("\n\n")}

Decide por variante (usa exactamente los variantId de arriba) y en conjunto.`,
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
  system: `Eres analista de contenido. Con métricas de publicaciones extraes qué funcionó y por qué, aprendizajes aplicables, recomendaciones concretas y nuevas ideas. No inventes datos: razona solo con los números de la entrada y di cuándo la muestra es pequeña.`,
  prompt: (input) =>
    `Marca: ${input.brand.name}. Audiencias: ${input.brand.audiences.join(", ") || "no definidas"}.
Publicaciones con métricas (${input.metrics.length}):
${JSON.stringify(input.metrics, null, 2)}

Qué necesito: summary (3-4 frases), topPerformers (máximo 3, con la razón basada en números), learnings (3-5), recommendations (3-5, accionables: qué publicar, en qué red, con qué formato), suggestedIdeas (2-4 títulos de trabajo con su justificación).`,
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
