import type { Brand, KnowledgeItem } from "@/lib/db/schema";
import { BrandContextSchema, type BrandContext } from "./schemas";

/**
 * Convierte una marca de la base de datos en el contexto que reciben los
 * agentes. Deliberadamente excluye conexiones sociales y cualquier secreto.
 */
export function toBrandContext(brand: Brand): BrandContext {
  return BrandContextSchema.parse({
    id: brand.id,
    name: brand.name,
    description: brand.description,
    locale: brand.locale,
    products: brand.products,
    audiences: brand.audiences,
    voiceTone: brand.voiceTone,
    offers: brand.offers,
    ctas: brand.ctas,
    proofPoints: brand.proofPoints,
    preferredWords: brand.preferredWords,
    forbiddenWords: brand.forbiddenWords,
    forbiddenPromises: brand.forbiddenPromises,
    approvedExamples: brand.approvedExamples,
  });
}

export function toKnowledgeRefs(items: KnowledgeItem[], limit = 8) {
  return items.slice(0, limit).map((item) => ({
    title: item.title,
    type: item.type,
    content: item.content.slice(0, 1500),
    sourceUrl: item.sourceUrl ?? null,
  }));
}
