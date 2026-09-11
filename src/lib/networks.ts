/** Redes sociales soportadas y sus restricciones de formato. */
export const NETWORKS = ["instagram", "facebook", "linkedin", "x", "youtube"] as const;
export type Network = (typeof NETWORKS)[number];

export function isNetwork(value: unknown): value is Network {
  return typeof value === "string" && (NETWORKS as readonly string[]).includes(value);
}

export interface NetworkSpec {
  label: string;
  maxChars: number;
  formats: string[];
  defaultFormat: string;
  aspectRatios: string[];
  hashtagRange: [number, number];
  tone: string;
}

export const NETWORK_SPECS: Record<Network, NetworkSpec> = {
  instagram: {
    label: "Instagram",
    maxChars: 2200,
    formats: ["reel", "carrusel", "imagen", "historia"],
    defaultFormat: "carrusel",
    aspectRatios: ["4:5", "1:1", "9:16"],
    hashtagRange: [3, 8],
    tone: "visual, cercano, primera persona, frases cortas",
  },
  facebook: {
    label: "Facebook",
    maxChars: 5000,
    formats: ["publicación", "video", "imagen", "enlace"],
    defaultFormat: "publicación",
    aspectRatios: ["1:1", "4:5", "16:9"],
    hashtagRange: [0, 3],
    tone: "conversacional, comunidad, invita a comentar",
  },
  linkedin: {
    label: "LinkedIn",
    maxChars: 3000,
    formats: ["publicación", "artículo", "carrusel PDF", "video"],
    defaultFormat: "publicación",
    aspectRatios: ["1:1", "4:5", "16:9"],
    hashtagRange: [2, 5],
    tone: "profesional, con datos, aprendizaje, sin exageraciones",
  },
  x: {
    label: "X",
    maxChars: 280,
    formats: ["post", "hilo", "imagen", "video"],
    defaultFormat: "hilo",
    aspectRatios: ["16:9", "1:1"],
    hashtagRange: [0, 2],
    tone: "directo, provocador, una idea por post",
  },
  youtube: {
    label: "YouTube",
    maxChars: 5000,
    formats: ["video largo", "short", "comunidad"],
    defaultFormat: "short",
    aspectRatios: ["16:9", "9:16"],
    hashtagRange: [2, 5],
    tone: "explicativo, con estructura, gancho en los primeros 3 segundos",
  },
};
