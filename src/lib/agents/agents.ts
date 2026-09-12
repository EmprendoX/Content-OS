import type { ZodType } from "zod";
import type { GenerateObjectRequest, LLMProvider } from "@/lib/llm/provider";
import { NETWORK_SPECS, type Network } from "@/lib/networks";
import {
  GENERIC_PHRASES,
  NETWORK_PLAYBOOK,
  STYLE_RULES,
  localeGuide,
  renderBrandBrief,
  renderNetworkConstraints,
  roboticSignals,
} from "./prompts";
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

export { AGENT_CATALOG } from "./catalog";

/**
 * Definición de un agente: entrada y salida tipadas y validadas con Zod.
 * `runAgent` valida la entrada, pide un objeto al proveedor y valida la salida.
 */
export interface AgentDefinition<I, O> {
  name: string;
  task: string;
  inputSchema: ZodType<I>;
  outputSchema: ZodType<O>;
  system: string;
  prompt: (input: I) => string;
  /** Esfuerzo de razonamiento: más alto para redactar, más bajo para tareas mecánicas. */
  effort?: GenerateObjectRequest<O>["effort"];
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
    effort: agent.effort,
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
      ? `Intento anterior (es tu BASE: parte de este texto):\n"""\n${feedback.previousAttempt}\n"""`
      : "",
    "Instrucciones: aplica exactamente los cambios pedidos sobre el intento anterior y conserva literalmente todo lo que no se mencione. No reescribas desde la pieza maestra, no cambies el hook si no te lo piden y no reintroduzcas jerga ni frases que ya se habían corregido. Explica en \"notes\" qué cambiaste.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Recorta la primera línea si el modelo devuelve un hook demasiado largo. */
function firstLine(text: string): string {
  return text.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
}

// ---------------------------------------------------------------------------
// 1. ResearchAgent
// ---------------------------------------------------------------------------
export const ResearchAgent: AgentDefinition<ResearchInput, ResearchOutput> = {
  name: "ResearchAgent",
  task: "research",
  effort: "low",
  inputSchema: ResearchInputSchema,
  outputSchema: ResearchOutputSchema,
  system: `Eres un investigador de contenido con experiencia en marketing para negocios reales. Tu trabajo es entender un tema desde el punto de vista de la audiencia de la marca y convertirlo en material que un redactor pueda usar para escribir algo que suene a experiencia vivida.
No tienes acceso a internet: tu única fuente externa es la biblioteca de conocimiento de la marca. Puedes aportar conocimiento general del sector, pero marca como "riesgo" cualquier afirmación que necesite verificación.
${localeGuide(undefined)}`,
  prompt: (input) =>
    `${renderBrandBrief(input.brand)}

# Encargo
Tema: "${input.topic}"
Campaña: ${input.campaign || "sin campaña"}
Objetivo de negocio: ${input.goal || "no definido; asume captación de clientes"}

# Qué necesito
- summary: 3 a 5 frases que expliquen por qué este tema le importa a ESTA audiencia ahora y qué postura debería tomar la marca. Escrito con naturalidad, no como informe.
- keyInsights: 3 a 5 observaciones concretas y no obvias, cada una con su porqué. Nada de generalidades.
- audiencePains: 3 a 5 frustraciones dichas como las diría la propia audiencia, en primera persona, con sus palabras ("ya pagué dos páginas y ninguna me trae clientes").
- angles: 3 a 5 formas distintas de contar el tema (una escena real, un error que todos cometen, una creencia equivocada, un antes y después, una decisión difícil). Cada ángulo es una frase que describe la historia, no un titular de clickbait.
- sources: qué elementos de la biblioteca usaste y para qué.
- risks: afirmaciones que no debemos hacer, cifras no autorizadas, promesas prohibidas cercanas al tema.`,
};

// ---------------------------------------------------------------------------
// 2. StrategyAgent
// ---------------------------------------------------------------------------
export const StrategyAgent: AgentDefinition<StrategyInput, StrategyOutput> = {
  name: "StrategyAgent",
  task: "strategy",
  effort: "low",
  inputSchema: StrategyInputSchema,
  outputSchema: StrategyOutputSchema,
  system: `Eres un estratega de contenidos con criterio. Conviertes una investigación en una decisión editorial: un objetivo, una idea central, un ángulo y un plan por red. Decides; no enumeras opciones.
${localeGuide(undefined)}`,
  prompt: (input) =>
    `${renderBrandBrief(input.brand)}

# Investigación previa
${JSON.stringify(input.research, null, 2)}

# Encargo
Tema: "${input.topic}". Campaña: ${input.campaign || "sin campaña"}. Objetivo: ${input.goal || "captación"}.
Redes a cubrir: ${input.networks.map((n) => NETWORK_SPECS[n].label).join(", ")}.
Formatos disponibles por red: ${input.networks.map((n) => `${NETWORK_SPECS[n].label}: ${NETWORK_SPECS[n].formats.join("/")}`).join("; ")}.

# Qué necesito
- objective: qué debe hacer o pensar el lector después de leer.
- coreMessage: UNA frase que resume lo que queremos que el lector se lleve, dicha como la diría la marca en voz alta (no como eslogan).
- contentPillar: pilar de contenido al que pertenece.
- angle: la forma elegida de contar el tema (una de las de la investigación o una mejor), descrita en una o dos frases: qué escena o idea abre, hacia dónde va.
- keyPoints: 3 ideas que sostienen el mensaje, cada una con el ejemplo concreto que la ilustra.
- toneNotes: 2 o 3 frases para el redactor sobre cómo debe sonar esta pieza en particular (qué sí, qué no).
- networkPlan: para cada red, formato elegido y por qué, objetivo específico en esa red y prioridad 1-3.`,
};

// ---------------------------------------------------------------------------
// 3. MasterContentAgent
// ---------------------------------------------------------------------------
export const MasterContentAgent: AgentDefinition<MasterInput, MasterOutput> = {
  name: "MasterContentAgent",
  task: "master",
  effort: "medium",
  inputSchema: MasterInputSchema,
  outputSchema: MasterOutputSchema,
  system: `Eres un escritor con experiencia real en negocios, que escribe para la marca como si fuera su dueño. Escribes la PIEZA MAESTRA: el texto completo y canónico del que saldrán todas las adaptaciones. No es un post ni un esquema; es un texto bien escrito que alguien leería hasta el final.
${STYLE_RULES}`,
  prompt: (input) =>
    `${renderBrandBrief(input.brand)}

# Lo que hay que contar
Idea central: ${input.strategy.coreMessage}
Cómo contarlo: ${input.strategy.angle}
Qué debe pasar en el lector: ${input.strategy.objective}
Ideas que lo sostienen (con sus ejemplos):
${input.strategy.keyPoints.map((p) => `- ${p}`).join("\n")}
Cómo debe sonar esta pieza: ${input.strategy.toneNotes}

# Material de apoyo
Lo que sabemos: ${input.research.keyInsights.join(" | ")}
Cómo lo dice la audiencia: ${input.research.audiencePains.join(" | ")}
Lo que no podemos afirmar: ${input.research.risks.join(" | ")}
${feedbackBlock(input.feedback)}

# Qué necesito
- title: título de trabajo interno (no se publica).
- hook: la primera frase del texto. Máximo 15 palabras. Debe abrir con algo concreto (una escena, una afirmación con opinión, un dato autorizado). Es también la primera línea de "body".
- body: entre 300 y 500 palabras de texto corrido, en párrafos de 1 a 4 frases separados por una línea en blanco. Estructura libre pero con arco: empieza en una situación concreta, desarrolla las tres ideas hilándolas (sin numerarlas ni etiquetarlas), y cierra volviendo a la idea central con una frase que se quede. El llamado a la acción va integrado en las últimas líneas como una frase natural. Sin encabezados, sin negritas, sin listas.
- keyMessage: la idea central tal como quedó dicha en el texto.
- cta: el llamado a la acción tal como aparece en el cierre.
- proofPointsUsed: qué datos autorizados usaste (solo los del brief).
- wordCount: número de palabras del body.`,
  postProcess: (_input, output) => ({
    ...output,
    hook: output.hook.trim() || firstLine(output.body),
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
    effort: "medium",
    inputSchema: AdapterInputSchema,
    outputSchema: AdapterOutputSchema,
    system: `Eres quien escribe ${spec.label} para la marca, con la voz de su dueño. Recibes una pieza maestra y la vuelves a contar para ${spec.label}: misma idea, pero escrita desde cero pensando en cómo se lee aquí, con la longitud y el ritmo de esta red. Adaptar no es recortar ni esquematizar: es contar lo mismo de la forma en que funciona en este lugar, y que siga sonando a persona.
${NETWORK_PLAYBOOK[network]}
${STYLE_RULES}`,
    prompt: (input) =>
      `${renderBrandBrief(input.brand)}

# Pieza maestra (la idea y la voz que debes conservar)
Idea central: ${input.master.keyMessage}
Cierre: ${input.master.cta}
Datos autorizados usados: ${input.master.proofPointsUsed.join(" | ") || "ninguno"}
Texto completo:
"""
${input.master.body}
"""

# Para esta red
Formato: ${input.plan.format}. Objetivo en ${spec.label}: ${input.plan.objective}.
${renderNetworkConstraints(network)}
${feedbackBlock(input.feedback)}

# Qué necesito
- network: "${network}".
- format: el formato usado (uno de los válidos).
- hook: la primera línea del copy, tal cual (máximo 12 palabras). Reescrita para esta red, no copiada de la maestra.
- copy: el texto completo listo para publicar, con saltos de línea reales. Empieza por el hook. Sin el bloque de hashtags dentro. Respeta el límite de caracteres.
- cta: la frase de cierre con el llamado a la acción, tal como aparece en el copy.
- hashtags: lista con "#", dentro del rango permitido, específicos del tema.
- notes: guion o indicaciones de producción según el formato, y, si hubo feedback, qué cambiaste.

Última comprobación antes de responder: lee el copy en voz alta. Si tiene etiquetas tipo "Error 1:", flechas, listas de fragmentos o suena a presentación, reescríbelo como se lo contarías a un cliente en una llamada.`,
    postProcess: (input, output) => {
      // Si el modelo repite el primer párrafo (hook duplicado), se conserva una sola vez.
      const paragraphs = output.copy.trim().split(/\n\s*\n/);
      if (paragraphs.length > 1 && paragraphs[0].trim() === paragraphs[1].trim()) paragraphs.splice(1, 1);
      const copy = paragraphs.join("\n\n");
      return {
        ...output,
        network,
        hook: output.hook.trim() || firstLine(copy),
        hashtags: output.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).filter((h) => h.length > 1),
        copy: network === "x" ? copy : copy.slice(0, input.constraints.maxChars),
      };
    },
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
  effort: "low",
  inputSchema: VisualBriefInputSchema,
  outputSchema: VisualBriefOutputSchema,
  system: `Eres director de arte para redes sociales. Escribes briefs breves y ejecutables para un diseñador o para una herramienta de generación de imágenes. Piensa en legibilidad en el celular y en coherencia con la marca. Sin adjetivos vacíos: instrucciones concretas.`,
  prompt: (input) =>
    `Marca: ${input.brand.name}. Voz: ${input.brand.voiceTone || "clara y directa"}.
Red: ${input.adaptation.network}. Formato: ${input.adaptation.format}.
Primera línea del copy: ${input.adaptation.hook}
Notas de producción del redactor: ${input.adaptation.notes || "ninguna"}
Ratios permitidos: ${input.aspectRatios.join(", ")}.

Qué necesito:
- concept: una frase que describa la imagen o secuencia (qué se ve, qué comunica).
- aspectRatio: uno de los permitidos, el más adecuado al formato.
- style: estilo visual concreto (tipografía, composición, fotografía o ilustración, fondo).
- textOverlay: el texto que va sobre la imagen (máximo 8 palabras).
- colorPalette: 2 a 4 colores en hexadecimal coherentes con la marca.
- altText: descripción accesible de la imagen en una frase.
- assetsNeeded: recursos necesarios (logo, foto de producto, captura, icono...).`,
};

// ---------------------------------------------------------------------------
// 10. ReviewAgent — combina LLM con comprobaciones deterministas
// ---------------------------------------------------------------------------
export const ReviewAgent: AgentDefinition<ReviewInput, ReviewOutput> = {
  name: "ReviewAgent",
  task: "review",
  effort: "low",
  inputSchema: ReviewInputSchema,
  outputSchema: ReviewOutputSchema,
  system: `Eres un editor de textos exigente que ha leído miles de publicaciones de marcas y distingue en dos líneas cuándo un texto lo escribió una persona y cuándo una IA. Evalúas una adaptación lista para publicar y devuelves una puntuación 0-100, si pasa o no, los problemas encontrados y sugerencias accionables.
Rúbrica (100 puntos):
- Naturalidad (30): ¿suena a una persona hablando? Penaliza fuerte el formato telegráfico (etiquetas "Error 1:", "Solución:", flechas, listas de fragmentos), las muletillas de IA, los adjetivos vacíos, el ritmo monótono y los dos puntos como muleta.
- Cumplimiento de marca (25): sin palabras ni promesas prohibidas, solo datos autorizados (parafraseados está bien si el dato no cambia), llamado a la acción permitido, dialecto correcto.
- Hook (15): específico, con algo concreto, funciona solo, ≤ 12 palabras.
- Claridad y concreción (15): una idea, ejemplos reales, sin relleno.
- Adecuación a la red (15): estructura, longitud, ritmo y hashtags nativos.
Severidad "alta": palabras o promesas prohibidas, longitud excedida, texto que claramente suena a IA (más de dos señales de estilo telegráfico o de muletillas). Severidad "media": problemas que un lector notaría. Severidad "baja": matices.
Convención del sistema: el campo "hook" es una copia de la primera línea del copy. Que el copy empiece con el hook NO es una repetición; no lo señales como problema.
Criterio de paso (lo aplica el sistema): pasa si no hay problemas altos, hay menos de tres medios y la puntuación es ≥ 75. Puntúa con coherencia: una pieza con solo matices "baja" debe estar por encima de 85.
Las sugerencias deben ser reescrituras concretas ("cambia X por Y"), no consejos vagos. Si una frase suena a IA, propón cómo la diría una persona.`,
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
${NETWORK_PLAYBOOK[input.adaptation.network]}
${
  input.appliedFeedback?.trim()
    ? `
# Feedback que esta versión YA aplicó
«${input.appliedFeedback.trim()}»
No pidas revertir estos cambios ni propongas lo contrario. Si se aplicaron correctamente, reconócelo y céntrate solo en lo que siga fallando.`
    : ""
}`,
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

    // Señales de "suena a IA": muletillas y estilo telegráfico.
    const foundPhrases = GENERIC_PHRASES.filter((phrase) => text.includes(phrase));
    for (const phrase of foundPhrases) {
      if (!has("claridad", phrase)) {
        issues.push({ type: "claridad", severity: "media", message: `Muletilla de IA: "${phrase}". Dilo como lo diría una persona.` });
      }
    }
    const signals = roboticSignals(input.adaptation.copy);
    const roboticScore = signals.labelLines + signals.arrows + signals.middleDots + signals.fragmentBullets;
    if (roboticScore > 0 && !has("tono", "telegráfico")) {
      const parts = [
        signals.labelLines ? `${signals.labelLines} líneas con etiqueta tipo "Solución:"` : "",
        signals.arrows ? `${signals.arrows} flechas` : "",
        signals.middleDots ? `${signals.middleDots} separadores "·"` : "",
        signals.fragmentBullets ? `${signals.fragmentBullets} viñetas de fragmentos` : "",
      ].filter(Boolean);
      issues.push({
        type: "tono",
        severity: roboticScore >= 3 ? "alta" : "media",
        message: `Estilo telegráfico (${parts.join(", ")}): suena a presentación, no a persona. Hila las ideas en frases completas.`,
      });
    }
    if (foundPhrases.length >= 3 && !has("tono", "muletillas")) {
      issues.push({ type: "tono", severity: "alta", message: `Acumula ${foundPhrases.length} muletillas de IA: el texto suena artificial.` });
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
    if (emojiCount > 3 && !has("tono", "emoji")) {
      issues.push({ type: "tono", severity: "media", message: `Hay ${emojiCount} emojis; deja como mucho uno.` });
    }
    if (!input.adaptation.cta.trim() && !has("cta")) {
      issues.push({ type: "cta", severity: "media", message: "Falta un llamado a la acción." });
    }

    // Umbral determinista: pasa si no hay problemas altos, hay menos de tres
    // medios y la puntuación (ya acotada) llega a 75.
    const hasHigh = issues.some((i) => i.severity === "alta");
    const mediumCount = issues.filter((i) => i.severity === "media").length;
    const cappedScore = Math.min(output.score, hasHigh ? 40 : mediumCount >= 3 ? 65 : 100);
    return {
      ...output,
      issues,
      passed: !hasHigh && mediumCount < 3 && cappedScore >= 75,
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
  effort: "low",
  inputSchema: EditorChiefInputSchema,
  outputSchema: EditorChiefOutputSchema,
  system: `Eres el editor jefe. Recibes las adaptaciones de una pieza con su revisión y redactas la decisión editorial. No tienes autoridad para aprobar: la aprobación final es siempre de una persona.
Regla de decisión: tu decisión por variante debe coincidir con la revisión. Si la revisión pasó, la variante va a READY_FOR_APPROVAL y tus comentarios son sugerencias opcionales para la persona que aprueba (máximo 3, las más valiosas). Si no pasó, va a NEEDS_CHANGES y tus comentarios son la lista exacta de cambios que aplicará el redactor: frase original → frase nueva.
Sé concreto y breve. Si una variante pasa, di en una frase por qué funciona antes de las sugerencias.`,
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
    // Garantía determinista: la decisión sigue a la revisión.
    const perVariant = input.variants.map((v) => {
      const decision = output.perVariant.find((d) => d.variantId === v.variantId);
      return {
        variantId: v.variantId,
        decision: v.review.passed ? ("READY_FOR_APPROVAL" as const) : ("NEEDS_CHANGES" as const),
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
  effort: "low",
  inputSchema: AnalyticsInputSchema,
  outputSchema: AnalyticsOutputSchema,
  system: `Eres analista de contenido. Con métricas de publicaciones extraes qué funcionó y por qué, aprendizajes aplicables, recomendaciones concretas y nuevas ideas. No inventes datos: razona solo con los números de la entrada y di cuándo la muestra es pequeña. Escribe con naturalidad, sin jerga.`,
  prompt: (input) =>
    `Marca: ${input.brand.name}. Audiencias: ${input.brand.audiences.join(", ") || "no definidas"}.
Publicaciones con métricas (${input.metrics.length}):
${JSON.stringify(input.metrics, null, 2)}

Qué necesito: summary (3-4 frases), topPerformers (máximo 3, con la razón basada en números), learnings (3-5), recommendations (3-5, accionables: qué publicar, en qué red, con qué formato), suggestedIdeas (2-4 títulos de trabajo con su justificación).`,
};
