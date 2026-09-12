import { NETWORK_SPECS, type Network } from "@/lib/networks";
import type { BrandContext } from "./schemas";

/**
 * Bloques de prompt compartidos por los agentes. El objetivo es contenido
 * específico, con voz de marca y sin frases genéricas.
 */

function list(items: string[], empty = "(sin datos)"): string {
  return items.length === 0 ? `- ${empty}` : items.map((i) => `- ${i}`).join("\n");
}

/** Brief de marca legible, no un volcado JSON. */
export function renderBrandBrief(brand: BrandContext): string {
  return [
    `# Marca: ${brand.name}`,
    brand.description ? `${brand.description}` : "",
    "",
    "## Voz y tono",
    brand.voiceTone || "Claro, directo y cercano.",
    "",
    "## Productos y servicios",
    list(brand.products),
    "",
    "## Audiencias (a quién le hablamos)",
    list(brand.audiences),
    "",
    "## Ofertas activas",
    list(brand.offers, "ninguna oferta específica"),
    "",
    "## Llamados a la acción permitidos (usa uno de estos o una variación muy cercana)",
    list(brand.ctas, "cierra invitando a escribir o comentar"),
    "",
    "## Pruebas y datos AUTORIZADOS (las únicas cifras y afirmaciones verificables que puedes usar)",
    list(brand.proofPoints, "no hay cifras autorizadas: no inventes ninguna"),
    "",
    "## Palabras preferidas",
    list(brand.preferredWords, "ninguna en particular"),
    "",
    "## PALABRAS PROHIBIDAS (nunca aparecen, ni en variantes)",
    list(brand.forbiddenWords, "ninguna"),
    "",
    "## PROMESAS PROHIBIDAS (ni literal ni parafraseadas)",
    list(brand.forbiddenPromises, "ninguna"),
    "",
    "## Ejemplos de contenido aprobado (referencia de estilo; no los copies)",
    list(brand.approvedExamples.map((e) => `«${e}»`), "sin ejemplos"),
  ]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n");
}

/** Reglas de escritura comunes a todo el contenido. */
export const STYLE_RULES = `# Reglas de escritura (obligatorias)
1. Escribe en español neutro y natural (tuteo salvo que la voz de marca diga lo contrario). Si los ejemplos aprobados están en otro idioma o registro, síguelos.
2. Sé concreto: situaciones reales, ejemplos, números solo si están autorizados. Cada frase debe aportar algo; elimina relleno.
3. Prohibidas las frases genéricas y de IA: "en el mundo actual", "en la era digital", "hoy en día", "no es ningún secreto", "en un mercado cada vez más competitivo", "revolucionar", "desbloquea", "lleva tu negocio al siguiente nivel", "sumérgete", "¡y mucho más!", "es importante destacar", "en resumen", "en conclusión".
4. Nada de exageraciones ni superlativos vacíos ("el mejor", "increíble", "único"). Nada de promesas de resultados que no estén en las pruebas autorizadas.
5. Un solo mensaje central por pieza. Una sola llamada a la acción.
6. Usa la voz de la marca de verdad: si es retadora, reta; si es sobria, no uses emojis ni exclamaciones.
7. Frases cortas. Párrafos de 1 a 3 líneas. Saltos de línea generosos para lectura en móvil.
8. No uses guiones largos (—) ni comillas tipográficas raras; usa puntos, comas y dos puntos.
9. No expliques lo que vas a hacer ni comentes tu proceso: entrega solo el contenido.`;

/** Guía específica por red, con estructura y errores típicos. */
export const NETWORK_PLAYBOOK: Record<Network, string> = {
  instagram: `# Playbook Instagram
- Formatos: carrusel (portada con el hook + 4-7 slides con una idea cada uno + slide final con CTA), reel (guion con gancho en 2 s, desarrollo en 3 bloques, cierre), imagen única.
- El copy acompaña al visual: primera línea = hook (lo único visible antes de "más"). Máximo 12 palabras en la primera línea.
- Estructura del copy: hook → 2-4 líneas de contexto o lista corta con saltos de línea → CTA → hashtags al final en bloque separado.
- Emojis: máximo 1 por bloque y solo si la voz de marca lo admite. Nunca emojis en cada línea.
- CTA típico: "guarda este post", "envíaselo a quien lo necesite", "link en bio". Sin URLs en el copy.
- Hashtags: entre 3 y 8, específicos del nicho, sin genéricos como #marketing o #amor. Mezcla 2 de nicho amplio y el resto concretos.
- Si el formato es carrusel, en "notes" describe slide a slide el texto de cada uno.`,
  facebook: `# Playbook Facebook
- Tono de comunidad y conversación; funciona lo narrativo (una historia breve, un caso, una situación reconocible).
- Estructura: hook de una línea → historia o explicación en 3-6 párrafos cortos → pregunta que invite a comentar → CTA.
- Puedes ser más largo que en Instagram, pero cada párrafo debe poder leerse solo.
- Hashtags: 0 a 3, opcionales. Sin bloques de hashtags.
- Evita el tono corporativo; escribe como una persona que conoce el tema y lo cuenta a otra.`,
  linkedin: `# Playbook LinkedIn
- Primera línea = hook con una idea contraintuitiva, un dato autorizado o una situación profesional concreta. Máximo 12 palabras. Nada de "Me complace anunciar".
- Estructura: hook → línea en blanco → contexto (2-3 líneas) → desarrollo en 3-5 puntos cortos con "→" o números → cierre con aprendizaje → pregunta abierta al lector.
- Sin enlaces en el cuerpo. Si hay enlace, indícalo en "notes" como "enlace en el primer comentario".
- Tono profesional, cercano, con criterio. Sin motivación vacía ni "humildemente".
- Hashtags: 2 a 5 al final, específicos del sector.
- Extensión ideal: 900-1.800 caracteres.`,
  x: `# Playbook X (hilo)
- Formato hilo: entre 4 y 7 posts separados por UNA línea en blanco. Cada post ≤ 270 caracteres (deja margen). Numera "1/", "2/"...
- Post 1: el hook. Debe funcionar solo: una afirmación fuerte, contraintuitiva o una promesa concreta de lo que viene. Sin "hilo 🧵" como única frase.
- Posts intermedios: una idea por post, con ejemplo o consecuencia. Sin relleno.
- Último post: cierre + CTA en una frase. Puede repetir el mensaje central.
- Hashtags: ninguno o máximo 2 en el último post. Sin emojis en cada post.
- Escribe el hilo completo en "copy". En "hook" solo el post 1.`,
  youtube: `# Playbook YouTube
- Short (45-60 s vertical): guion con GANCHO (0-3 s, una frase que plantea el problema o promete algo concreto), DESARROLLO (3 bloques de 10-15 s, una idea cada uno, con ejemplo), CIERRE (CTA en una frase).
- Video largo: título (≤ 60 caracteres, con beneficio claro), estructura por secciones con minutos estimados, gancho de los primeros 30 s, descripción de 3-5 líneas.
- En "copy" entrega el guion completo con etiquetas [GANCHO], [BLOQUE 1], [BLOQUE 2], [BLOQUE 3], [CIERRE]. OBLIGATORIO: termina el copy con [TÍTULO] (≤ 60 caracteres) y [DESCRIPCIÓN] (3-5 líneas). Sin estas dos secciones la pieza se rechaza.
- Habla en segunda persona, ritmo rápido, frases de máximo 12 palabras para que se lean como subtítulos.
- Hashtags: 2 a 5 para la descripción.
- "notes" es OBLIGATORIO y no puede quedar vacío: plano, texto en pantalla por bloque, b-roll y ritmo de cortes.`,
};

export function renderNetworkConstraints(network: Network): string {
  const spec = NETWORK_SPECS[network];
  return `Límite de caracteres: ${spec.maxChars}. Formatos válidos: ${spec.formats.join(", ")}. Hashtags: entre ${spec.hashtagRange[0]} y ${spec.hashtagRange[1]}. Tono de la red: ${spec.tone}.`;
}

/** Frases genéricas que el revisor penaliza de forma determinista. */
export const GENERIC_PHRASES = [
  "en el mundo actual",
  "en la era digital",
  "hoy en día",
  "no es ningún secreto",
  "cada vez más competitivo",
  "revolucionar",
  "desbloquea",
  "siguiente nivel",
  "sumérgete",
  "y mucho más",
  "es importante destacar",
  "en resumen,",
  "en conclusión",
  "me complace anunciar",
  "en un mundo donde",
];
