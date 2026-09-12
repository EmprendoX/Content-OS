import { NETWORK_SPECS, type Network } from "@/lib/networks";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/locales";
import type { BrandContext } from "./schemas";

/**
 * Bloques de prompt compartidos por los agentes. Prioridad absoluta: que el
 * texto suene a una persona que sabe del tema, no a una presentación ni a IA.
 */

function list(items: string[], empty = "(sin datos)"): string {
  return items.length === 0 ? `- ${empty}` : items.map((i) => `- ${i}`).join("\n");
}

// ---------------------------------------------------------------------------
// Dialecto
// ---------------------------------------------------------------------------
export { LOCALES, LOCALE_LABELS, type Locale };

const LOCALE_GUIDES: Record<Locale, string> = {
  "es-MX": `Escribe en español de México, como se habla en una conversación de trabajo relajada. Tuteo. Vocabulario: "negocio", "página web" o "sitio", "celular", "correo", "cotización", "cliente", "emprendedor", "dueño de negocio", "renta", "computadora", "ahorita" solo si la marca es muy informal. Evita españolismos: nada de "pymes", "autónomos", "móvil", "ordenador", "vosotros", "vale", "coger", "molar", "tío", "flipar", "hostia", "currar", "pasta" (dinero), "el finde".`,
  "es-ES": `Escribe en español de España, cercano y natural. Tuteo. Vocabulario: "pyme", "autónomo", "móvil", "ordenador", "correo", "presupuesto". Evita mexicanismos y anglicismos innecesarios.`,
  "es-AR": `Escribe en español rioplatense. Voseo ("vos tenés", "fijate"). Vocabulario: "laburo", "plata", "celular", "computadora", "emprendedor". Evita españolismos y mexicanismos.`,
  "es-CO": `Escribe en español de Colombia, cálido y claro. Tuteo (o usted si la marca es formal). Vocabulario: "negocio", "celular", "computador", "correo", "plata". Evita españolismos.`,
  "es-419": `Escribe en español neutro latinoamericano. Tuteo. Vocabulario: "negocio", "celular", "computadora", "correo". Evita españolismos ("pymes", "autónomos", "móvil", "ordenador", "vosotros") y localismos marcados.`,
};

export function localeGuide(locale: string | undefined): string {
  return LOCALE_GUIDES[(locale as Locale) in LOCALE_GUIDES ? (locale as Locale) : "es-MX"];
}

// ---------------------------------------------------------------------------
// Brief de marca
// ---------------------------------------------------------------------------
export function renderBrandBrief(brand: BrandContext): string {
  return [
    `# Marca: ${brand.name}`,
    brand.description ? `${brand.description}` : "",
    "",
    "## Cómo habla esta marca",
    brand.voiceTone || "Clara, directa y cercana.",
    "",
    "## Idioma y región",
    localeGuide(brand.locale),
    "",
    "## Productos y servicios",
    list(brand.products),
    "",
    "## A quién le hablamos",
    list(brand.audiences),
    "",
    "## Ofertas activas",
    list(brand.offers, "ninguna oferta específica"),
    "",
    "## Llamados a la acción permitidos (uno de estos o una variación muy cercana)",
    list(brand.ctas, "cierra invitando a escribir o comentar"),
    "",
    "## Datos y pruebas AUTORIZADOS (las únicas cifras y afirmaciones verificables que puedes usar; puedes parafrasearlas sin cambiar el dato)",
    list(brand.proofPoints, "no hay cifras autorizadas: no inventes ninguna"),
    "",
    "## Palabras que la marca usa",
    list(brand.preferredWords, "ninguna en particular"),
    "",
    "## PALABRAS PROHIBIDAS (nunca aparecen, ni en variantes)",
    list(brand.forbiddenWords, "ninguna"),
    "",
    "## PROMESAS PROHIBIDAS (ni literales ni parafraseadas)",
    list(brand.forbiddenPromises, "ninguna"),
    "",
    "## Textos reales de la marca (imita su ritmo, su vocabulario y su forma de empezar y cerrar; no copies frases)",
    brand.approvedExamples.length > 0
      ? brand.approvedExamples.map((e, i) => `--- ejemplo ${i + 1} ---\n${e}`).join("\n\n")
      : "- sin ejemplos: apóyate en la descripción de voz",
  ]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n");
}

// ---------------------------------------------------------------------------
// Reglas de escritura
// ---------------------------------------------------------------------------
export const STYLE_RULES = `# Cómo debe sonar el texto (esto es lo más importante)
Escribe como una persona con experiencia real que le cuenta algo a alguien que respeta. No como un consultor haciendo una presentación, no como un manual y no como una IA.

Lo que hace que un texto suene humano:
- Fluye. Las ideas se conectan entre sí con transiciones naturales ("y eso es lo que pasa cuando...", "lo curioso es que...", "aquí viene lo importante"), no con etiquetas.
- Tiene ritmo: frases largas y cortas mezcladas. Una frase corta después de una larga para rematar. Nunca tres frases seguidas con la misma estructura.
- Va a lo concreto: una escena, un caso, un número autorizado, un diálogo de dos líneas. "Un cliente nos escribió el martes con..." vale más que "muchos negocios enfrentan...".
- Tiene opinión. La marca cree algo y lo dice. Sin cubrirse con "puede que", "en algunos casos", "depende".
- Habla de tú a tú. Segunda persona cuando le hablas al lector, primera persona del plural cuando hablas de la marca.

Lo que hace que un texto suene a IA (PROHIBIDO):
- Formato telegráfico con etiquetas: "Error 1:", "Problema:", "Solución:", "Resultado:", "Consecuencia:", "Aprendizaje:", "Contexto:", "Ejemplo:". Si necesitas presentar tres ideas, hílalas en párrafos.
- Flechas (→), separadores con punto medio (·), viñetas de fragmentos sin verbo, listas de más de una en la misma pieza.
- Empezar con pregunta retórica vacía o con "¿Sabías que", "¿Te ha pasado que", "¿Alguna vez".
- Muletillas: "en el mundo actual", "hoy en día", "en la era digital", "no es ningún secreto", "es fundamental", "cabe destacar", "es importante mencionar", "en este sentido", "sin duda", "en definitiva", "en resumen", "en conclusión", "a la hora de", "de manera efectiva", "de forma eficaz", "no solo... sino también", "el poder de", "descubre cómo", "lleva tu negocio al siguiente nivel", "potenciar", "maximizar", "optimizar" (como verbo comodín), "accionable", "clave" (como adjetivo), "estratégico" (como adjetivo vacío), "robusto", "integral", "transformar", "revolucionar", "impulsar" (salvo que sea palabra de la marca), "aprovechar al máximo".
- Cierres de manual: "¡Y listo!", "¡Empieza hoy!", "¡No esperes más!", "Esperamos que te sirva".
- Superlativos y adjetivos vacíos: "increíble", "único", "el mejor", "espectacular", "poderoso", "efectivo".
- Emojis como decoración. Máximo uno por pieza y solo si la marca es informal.
- Guiones largos (—) y comillas tipográficas. Usa comas, puntos y dos puntos con moderación: nunca dos puntos como muleta para introducir cada idea.
- Meta-comentarios sobre el texto o el proceso ("en este post", "a continuación te explico").

Reglas de marca:
- Solo cifras y afirmaciones de los datos autorizados. Nada de promesas de resultados.
- Ninguna palabra prohibida, ninguna promesa prohibida.
- Un mensaje central por pieza y un solo llamado a la acción, integrado en el cierre como una frase natural, no como un botón pegado.

Antes de responder, léelo mentalmente en voz alta. Si suena a diapositiva, a lista de consultor o a "contenido para redes", reescríbelo hasta que suene a alguien hablando.`;

// ---------------------------------------------------------------------------
// Playbook por red
// ---------------------------------------------------------------------------
export const NETWORK_PLAYBOOK: Record<Network, string> = {
  instagram: `# Instagram
La primera línea es lo único que se ve antes de "más": tiene que enganchar con algo concreto y específico, no con una promesa genérica. Máximo 12 palabras.
El copy es una conversación corta: 3 a 6 párrafos de una o dos frases, con línea en blanco entre ellos para que respire en el celular. Cuenta una escena o una idea con opinión; no hagas un tutorial numerado.
Si el formato es carrusel, el copy es el texto que acompaña; el guion slide a slide va en "notes" (portada con la idea fuerte, una idea por slide con una frase completa, última slide con el cierre).
Si es reel, el copy es el pie del video; el guion hablado va en "notes", escrito tal cual se dirá en voz alta.
Cierre con un llamado a la acción natural ("si quieres que revisemos la tuya, escríbenos", "guárdalo para cuando toque rediseñar").
Sin URLs en el copy. Hashtags: entre 3 y 8, específicos del nicho, aparte del copy.`,
  facebook: `# Facebook
Aquí funciona lo narrativo: una historia corta, un caso con nombre ficticio, algo que pasó. Puede ser más largo que Instagram, pero cada párrafo debe leerse solo y tener 1 a 3 frases.
Tono de comunidad: como si le escribieras a gente que ya te conoce. Termina con una pregunta real (no "¿y tú qué opinas?") o con la invitación de la marca.
Hashtags: 0 a 3. Sin bloques de hashtags.`,
  linkedin: `# LinkedIn
La primera línea es el gancho: una idea contraintuitiva, una escena de trabajo concreta o un dato autorizado. Máximo 12 palabras. Nada de "Me complace", nada de preguntas vacías.
Después una línea en blanco y párrafos cortos (1 a 3 frases) que desarrollan UNA idea con ejemplos reales y opinión. Es un texto que se lee de arriba abajo con ritmo, no un esquema. Si de verdad hace falta una lista, una sola, corta, con frases completas.
Cierra con un aprendizaje dicho con tus palabras y una pregunta específica o el llamado a la acción de la marca.
Extensión ideal: 900 a 1.600 caracteres. Sin enlaces en el cuerpo (si hay, dilo en "notes": enlace en el primer comentario). Hashtags: 2 a 5 al final.`,
  x: `# X (hilo)
Entre 4 y 7 posts separados por UNA línea en blanco, cada uno de máximo 270 caracteres. Numera "1/", "2/"...
El post 1 tiene que funcionar solo: una afirmación fuerte y específica, escrita como la diría una persona. No anuncies el hilo.
Cada post siguiente desarrolla una sola idea con frases completas, como si hablaras: nada de "Error 1:", nada de listas dentro de un post, nada de fragmentos sin verbo.
El último post cierra con la idea central y el llamado a la acción en una o dos frases. Hashtags: ninguno o máximo 2 al final.`,
  youtube: `# YouTube
Short (45 a 60 segundos): el guion se escribe como se va a decir en voz alta, con frases habladas, pausas y ritmo. Primera frase en los primeros 3 segundos con el problema o la promesa concreta. Luego tres momentos que se encadenan de forma natural y un cierre con la invitación de la marca.
Marca las secciones solo con [GANCHO], [DESARROLLO] y [CIERRE]; dentro de cada una, texto hablado corrido, sin etiquetas ni viñetas.
OBLIGATORIO: termina el copy con [TÍTULO] (máximo 60 caracteres, con el beneficio claro) y [DESCRIPCIÓN] (3 a 5 líneas escritas con naturalidad, con el llamado a la acción).
"notes" es obligatorio: plano, texto en pantalla por momento, b-roll y ritmo de cortes. Hashtags: 2 a 5 para la descripción.`,
};

export function renderNetworkConstraints(network: Network): string {
  const spec = NETWORK_SPECS[network];
  return `Límite de caracteres: ${spec.maxChars}. Formatos válidos: ${spec.formats.join(", ")}. Hashtags: entre ${spec.hashtagRange[0]} y ${spec.hashtagRange[1]}.`;
}

// ---------------------------------------------------------------------------
// Detección determinista de "suena a IA"
// ---------------------------------------------------------------------------

/** Frases que el revisor penaliza como severidad media. */
export const GENERIC_PHRASES = [
  "en el mundo actual",
  "en la era digital",
  "hoy en día",
  "no es ningún secreto",
  "cada vez más competitivo",
  "es fundamental",
  "cabe destacar",
  "es importante mencionar",
  "es importante destacar",
  "en este sentido",
  "sin duda",
  "en definitiva",
  "en resumen,",
  "en conclusión",
  "a la hora de",
  "de manera efectiva",
  "de forma eficaz",
  "el poder de",
  "descubre cómo",
  "siguiente nivel",
  "revolucionar",
  "desbloquea",
  "sumérgete",
  "y mucho más",
  "me complace anunciar",
  "en un mundo donde",
  "¿sabías que",
  "¿te ha pasado",
  "¿alguna vez",
  "¡y listo!",
  "no esperes más",
  "aprovechar al máximo",
];

/** Etiquetas de estilo telegráfico al inicio de línea ("Solución: ..."). */
export const LABEL_PATTERN = /^\s*(error|problema|soluci[oó]n|resultado|consecuencia|aprendizaje|contexto|ejemplo|paso|tip|clave|beneficio|acci[oó]n|dato|antes|despu[eé]s|mito|realidad)\s*\d*\s*:/i;

export interface RoboticSignals {
  labelLines: number;
  arrows: number;
  middleDots: number;
  fragmentBullets: number;
}

/** Cuenta señales de texto telegráfico o de IA. */
export function roboticSignals(text: string): RoboticSignals {
  const lines = text.split("\n");
  return {
    labelLines: lines.filter((l) => LABEL_PATTERN.test(l)).length,
    arrows: (text.match(/→/g) ?? []).length,
    middleDots: (text.match(/ · /g) ?? []).length,
    fragmentBullets: lines.filter((l) => /^\s*[-•*]\s+\S/.test(l) && l.trim().split(/\s+/).length <= 6).length,
  };
}
