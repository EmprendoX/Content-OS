import { eq } from "drizzle-orm";
import { addDays, setHours, setMinutes, startOfWeek } from "date-fns";
import type { Db } from "./client";
import {
  brandNetworks,
  brands,
  contentVariants,
  ideas,
  knowledgeItems,
  socialConnections,
  type NewBrand,
} from "./schema";
import { newId, slugify } from "@/lib/ids";
import { MockProvider } from "@/lib/llm/mock";
import { createPiece, runPipeline } from "@/lib/agents/orchestrator";
import { collectMetrics, publishVariant } from "@/lib/social/publisher";
import { encryptSecret } from "@/lib/security/crypto";
import { SETTING_KEYS, setSetting } from "@/lib/settings";
import { transitionVariant } from "@/lib/workflow/transitions";
import { audit } from "@/lib/security/audit";
import type { Network } from "@/lib/networks";

/**
 * Datos de demostración. Ejecuta el pipeline con MockProvider para que las
 * piezas sean coherentes con el flujo real, y deja registros en distintos
 * estados para poblar el dashboard.
 */

const HUMAN = "humano:demo";

type BrandSeed = Omit<NewBrand, "id" | "slug"> & { networks: { network: Network; handle: string }[] };

const BRAND_SEEDS: BrandSeed[] = [
  {
    name: "RexSite",
    color: "#2563eb",
    description: "Agencia de diseño y desarrollo web para pymes que necesitan una web que venda.",
    products: ["Sitios web corporativos", "Tiendas online", "Landing pages de campaña", "Mantenimiento web"],
    audiences: ["Pymes de servicios", "Emprendedores que lanzan su primer negocio", "Negocios locales sin presencia digital"],
    voiceTone: "Claro, directo y pedagógico. Tuteo. Sin tecnicismos innecesarios. Enfocado en resultados de negocio.",
    offers: ["Auditoría web gratuita de 20 minutos", "Web lista en 15 días"],
    ctas: ["Pide tu auditoría gratuita", "Escríbenos y revisamos tu web", "Reserva una llamada"],
    proofPoints: ["+120 webs entregadas", "Tiempo medio de entrega: 15 días", "Soporte respondido en menos de 24 h"],
    preferredWords: ["convertir", "claridad", "resultados", "proceso"],
    forbiddenWords: ["barato", "gratis total", "milagro"],
    forbiddenPromises: ["primer puesto en Google garantizado", "duplicar ventas en una semana"],
    approvedExamples: ["Tu web no necesita más efectos. Necesita que el visitante entienda en 5 segundos qué haces y por qué contratarte."],
    networks: [
      { network: "instagram", handle: "@rexsite" },
      { network: "linkedin", handle: "RexSite" },
      { network: "facebook", handle: "RexSite" },
    ],
  },
  {
    name: "IMPULSE",
    color: "#ea580c",
    description: "Programa de crecimiento y ventas para negocios de servicios que quieren escalar con sistemas.",
    products: ["Programa IMPULSE 90 días", "Sesiones de estrategia comercial", "Plantillas de procesos de venta"],
    audiences: ["Dueños de negocios de servicios con facturación estable", "Equipos comerciales pequeños"],
    voiceTone: "Energético, retador y práctico. Habla de sistemas, no de motivación vacía.",
    offers: ["Diagnóstico comercial gratuito", "Plaza limitada por cohorte"],
    ctas: ["Solicita tu diagnóstico", "Únete a la próxima cohorte", "Descarga la plantilla"],
    proofPoints: ["+40 negocios acompañados", "Método probado en 6 sectores"],
    preferredWords: ["sistema", "escalar", "predecible", "acción"],
    forbiddenWords: ["hazte rico", "sin esfuerzo"],
    forbiddenPromises: ["ingresos garantizados", "resultados en 7 días"],
    approvedExamples: ["Vender no es convencer. Es tener un sistema que hace que el cliente correcto llegue preparado."],
    networks: [
      { network: "instagram", handle: "@impulse.programa" },
      { network: "linkedin", handle: "IMPULSE" },
      { network: "youtube", handle: "IMPULSE" },
      { network: "x", handle: "@impulse_es" },
    ],
  },
  {
    name: "Propaganda Inteligente",
    color: "#7c3aed",
    description: "Estudio de publicidad y contenido con IA para marcas que quieren comunicar con criterio.",
    products: ["Campañas de contenido", "Consultoría de IA aplicada a marketing", "Formación in-company"],
    audiences: ["Directores de marketing", "Agencias que quieren integrar IA", "Marcas medianas"],
    voiceTone: "Inteligente, sobrio y con humor fino. Datos antes que adjetivos.",
    offers: ["Workshop de IA aplicada de 2 horas", "Auditoría de contenido"],
    ctas: ["Reserva el workshop", "Hablemos de tu contenido"],
    proofPoints: ["Contenido producido para 12 marcas", "Reducción del 60 % del tiempo de producción en casos internos"],
    preferredWords: ["criterio", "inteligencia", "estrategia", "evidencia"],
    forbiddenWords: ["viral garantizado", "revolucionario"],
    forbiddenPromises: ["reemplazar a tu equipo", "resultados automáticos"],
    approvedExamples: ["La IA no reemplaza el criterio. Lo amplifica, si lo tienes."],
    networks: [
      { network: "linkedin", handle: "Propaganda Inteligente" },
      { network: "instagram", handle: "@propaganda.inteligente" },
      { network: "x", handle: "@propagandaint" },
    ],
  },
  {
    name: "Marca personal",
    color: "#059669",
    description: "Perfil personal del fundador: aprendizajes sobre negocios digitales, contenido e IA.",
    products: ["Newsletter semanal", "Mentorías 1:1"],
    audiences: ["Emprendedores digitales", "Profesionales de marketing en transición a IA"],
    voiceTone: "Personal, honesto, en primera persona. Cuenta lo que funcionó y lo que no.",
    offers: ["Newsletter gratuita"],
    ctas: ["Suscríbete a la newsletter", "Cuéntame tu caso"],
    proofPoints: ["3 negocios construidos desde cero", "+5 años produciendo contenido semanal"],
    preferredWords: ["aprendí", "proceso", "honestamente", "sistema"],
    forbiddenWords: ["gurú", "secreto"],
    forbiddenPromises: ["libertad financiera", "éxito asegurado"],
    approvedExamples: ["Mi primer negocio fracasó por no tener proceso. El segundo funcionó por eso mismo."],
    networks: [
      { network: "linkedin", handle: "Agustín" },
      { network: "x", handle: "@agustin" },
      { network: "instagram", handle: "@agustin" },
    ],
  },
];

function thisWeekAt(dayOffset: number, hour: number, minute = 0): string {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  return setMinutes(setHours(addDays(monday, dayOffset), hour), minute).toISOString();
}

export function isSeeded(db: Db): boolean {
  return db.select().from(brands).limit(1).all().length > 0;
}

export async function seed(db: Db): Promise<void> {
  if (isSeeded(db)) return;
  const provider = new MockProvider();
  const deps = { db, provider, actorLabel: "orquestador" };

  // Configuración inicial: publicaciones desactivadas, dry run global activo.
  setSetting(db, SETTING_KEYS.publishingEnabled, "false");
  setSetting(db, SETTING_KEYS.globalDryRun, "true");
  setSetting(db, SETTING_KEYS.llmProvider, "mock");

  // Marcas, redes y conexiones simuladas
  const brandIds: Record<string, string> = {};
  for (const seedBrand of BRAND_SEEDS) {
    const { networks, ...brandData } = seedBrand;
    const id = newId();
    brandIds[seedBrand.name] = id;
    db.insert(brands).values({ ...brandData, id, slug: slugify(seedBrand.name) }).run();
    for (const net of networks) {
      db.insert(brandNetworks).values({ id: newId(), brandId: id, network: net.network, handle: net.handle }).run();
      db.insert(socialConnections)
        .values({
          id: newId(),
          brandId: id,
          network: net.network,
          label: `${net.handle} (simulada)`,
          encryptedToken: encryptSecret(`demo-token-${net.network}-${slugify(seedBrand.name)}`),
          status: "simulada",
          dryRun: true,
        })
        .run();
    }
    audit(db, { actor: HUMAN, action: "brand.create", entityType: "brand", entityId: id, details: { name: seedBrand.name } });
  }

  // Biblioteca de conocimiento
  const knowledge: { brand: string; title: string; type: "documento" | "enlace" | "nota" | "dato" | "ejemplo"; content: string; tags: string[] }[] = [
    { brand: "RexSite", title: "Guía interna: qué hace que una web venda", type: "documento", content: "Una web vende cuando responde en 5 segundos tres preguntas: qué haces, para quién y qué debe hacer el visitante ahora. El 70 % de las webs de pymes que auditamos fallan en la segunda.", tags: ["conversión", "auditoría"] },
    { brand: "RexSite", title: "Dato: tiempo de carga", type: "dato", content: "En nuestras auditorías, las webs que cargan en más de 4 segundos pierden más de la mitad de las visitas móviles antes de ver la oferta.", tags: ["rendimiento"] },
    { brand: "RexSite", title: "Ejemplo aprobado: post sobre claridad", type: "ejemplo", content: "Tu web no necesita más efectos. Necesita que el visitante entienda en 5 segundos qué haces y por qué contratarte.", tags: ["voz"] },
    { brand: "IMPULSE", title: "Método IMPULSE: los 4 pilares", type: "documento", content: "1) Oferta clara. 2) Canal de captación predecible. 3) Proceso de venta documentado. 4) Seguimiento sistemático. Sin los cuatro, el crecimiento depende de la suerte.", tags: ["método"] },
    { brand: "IMPULSE", title: "Objeción frecuente: 'no tengo tiempo para vender'", type: "nota", content: "La respuesta que mejor funciona: el sistema existe precisamente para que vender no dependa de tu tiempo, sino de un proceso repetible.", tags: ["ventas", "objeciones"] },
    { brand: "Propaganda Inteligente", title: "Caso interno: reducción de tiempo de producción", type: "dato", content: "Con un flujo de agentes revisado por humanos, el tiempo de producción de contenido mensual bajó un 60 % manteniendo la aprobación humana en cada pieza.", tags: ["IA", "caso"] },
    { brand: "Propaganda Inteligente", title: "Postura sobre IA y criterio", type: "nota", content: "No vendemos automatización total. Vendemos criterio amplificado: la IA propone, el equipo decide.", tags: ["posicionamiento"] },
    { brand: "Marca personal", title: "Historia: el primer negocio", type: "nota", content: "El primer negocio fracasó por no tener proceso comercial. Lo aprendido se convirtió en el sistema que hoy uso en todos los proyectos.", tags: ["historia"] },
  ];
  for (const item of knowledge) {
    db.insert(knowledgeItems)
      .values({ id: newId(), brandId: brandIds[item.brand], title: item.title, type: item.type, content: item.content, tags: item.tags })
      .run();
  }

  // Ideas
  const ideaSeeds: { brand: string; title: string; description: string; campaign: string; goal: string; priority: number; networks: Network[] }[] = [
    { brand: "RexSite", title: "Los 3 errores que hacen que tu web no venda", description: "Post educativo con los fallos más comunes vistos en auditorías.", campaign: "Auditoría web", goal: "Conseguir solicitudes de auditoría", priority: 1, networks: ["instagram", "linkedin", "facebook"] },
    { brand: "IMPULSE", title: "Por qué vender no es convencer", description: "Idea central del método: sistemas frente a persuasión.", campaign: "Cohorte otoño", goal: "Inscripciones al diagnóstico", priority: 1, networks: ["linkedin", "instagram", "x", "youtube"] },
    { brand: "Propaganda Inteligente", title: "La IA no reemplaza el criterio", description: "Posicionamiento sobre IA aplicada al marketing.", campaign: "Workshop IA", goal: "Reservas del workshop", priority: 1, networks: ["linkedin", "x", "instagram"] },
    { brand: "Marca personal", title: "Lo que aprendí de mi primer negocio fallido", description: "Historia personal con aprendizaje aplicable.", campaign: "Newsletter", goal: "Suscriptores", priority: 2, networks: ["linkedin", "x"] },
    { brand: "RexSite", title: "Checklist antes de lanzar una web", description: "Lista práctica de comprobaciones previas al lanzamiento.", campaign: "Auditoría web", goal: "Tráfico y guardados", priority: 2, networks: ["instagram", "linkedin"] },
    { brand: "IMPULSE", title: "Cómo documentar tu proceso de venta en una tarde", description: "Tutorial práctico.", campaign: "Cohorte otoño", goal: "Descargas de plantilla", priority: 3, networks: ["youtube", "linkedin"] },
  ];
  const ideaIds: string[] = [];
  for (const idea of ideaSeeds) {
    const id = newId();
    ideaIds.push(id);
    db.insert(ideas)
      .values({ id, brandId: brandIds[idea.brand], title: idea.title, description: idea.description, campaign: idea.campaign, goal: idea.goal, priority: idea.priority })
      .run();
  }

  // Pieza 1 (RexSite): pipeline completo → pendiente de aprobación
  const piece1 = createPiece(db, { brandId: brandIds.RexSite, ideaId: ideaIds[0], topic: ideaSeeds[0].title, campaign: ideaSeeds[0].campaign, goal: ideaSeeds[0].goal, networks: ideaSeeds[0].networks }, HUMAN);
  await runPipeline(piece1.id, deps);

  // Pieza 2 (IMPULSE): aprobada, programada y una publicada con métricas
  const piece2 = createPiece(db, { brandId: brandIds.IMPULSE, ideaId: ideaIds[1], topic: ideaSeeds[1].title, campaign: ideaSeeds[1].campaign, goal: ideaSeeds[1].goal, networks: ideaSeeds[1].networks }, HUMAN);
  await runPipeline(piece2.id, deps);
  const piece2Variants = db.select().from(contentVariants).where(eq(contentVariants.pieceId, piece2.id)).all();
  for (const variant of piece2Variants) {
    transitionVariant(db, variant.id, "APPROVED", "human", HUMAN, { approvedAt: new Date().toISOString() });
  }
  const [v2a, v2b, v2c, v2d] = piece2Variants;
  transitionVariant(db, v2a.id, "SCHEDULED", "human", HUMAN, { scheduledAt: thisWeekAt(1, 10) });
  transitionVariant(db, v2b.id, "SCHEDULED", "human", HUMAN, { scheduledAt: thisWeekAt(3, 12, 30) });
  if (v2d) transitionVariant(db, v2d.id, "SCHEDULED", "human", HUMAN, { scheduledAt: thisWeekAt(4, 18) });

  // Publicación simulada (no dry run) de la variante LinkedIn para tener resultados.
  setSetting(db, SETTING_KEYS.publishingEnabled, "true");
  const linkedinVariant = piece2Variants.find((v) => v.network === "linkedin") ?? v2c;
  db.update(socialConnections)
    .set({ dryRun: false })
    .where(eq(socialConnections.brandId, brandIds.IMPULSE))
    .run();
  const outcome = await publishVariant(db, linkedinVariant.id, { actor: HUMAN, confirmed: true, dryRun: false });
  if (outcome.job.status === "exito") await collectMetrics(db, linkedinVariant.id);
  db.update(socialConnections).set({ dryRun: true }).where(eq(socialConnections.brandId, brandIds.IMPULSE)).run();

  // Pieza 3 (Propaganda Inteligente): aprobada; Instagram falla por falta de archivo visual
  const piece3 = createPiece(db, { brandId: brandIds["Propaganda Inteligente"], ideaId: ideaIds[2], topic: ideaSeeds[2].title, campaign: ideaSeeds[2].campaign, goal: ideaSeeds[2].goal, networks: ideaSeeds[2].networks }, HUMAN);
  await runPipeline(piece3.id, deps);
  const piece3Variants = db.select().from(contentVariants).where(eq(contentVariants.pieceId, piece3.id)).all();
  for (const variant of piece3Variants) {
    transitionVariant(db, variant.id, "APPROVED", "human", HUMAN, { approvedAt: new Date().toISOString() });
  }
  const igVariant = piece3Variants.find((v) => v.network === "instagram");
  if (igVariant) {
    await publishVariant(db, igVariant.id, { actor: HUMAN, confirmed: true, dryRun: false });
  }
  const xVariant = piece3Variants.find((v) => v.network === "x");
  if (xVariant) {
    const result = await publishVariant(db, xVariant.id, { actor: HUMAN, confirmed: true, dryRun: false });
    if (result.job.status === "exito") await collectMetrics(db, xVariant.id);
  }
  setSetting(db, SETTING_KEYS.publishingEnabled, "false");

  // Pieza 4 (Marca personal): una variante devuelta a cambios por el revisor humano
  const piece4 = createPiece(db, { brandId: brandIds["Marca personal"], ideaId: ideaIds[3], topic: ideaSeeds[3].title, campaign: ideaSeeds[3].campaign, goal: ideaSeeds[3].goal, networks: ideaSeeds[3].networks }, HUMAN);
  await runPipeline(piece4.id, deps);
  const piece4Variants = db.select().from(contentVariants).where(eq(contentVariants.pieceId, piece4.id)).all();
  if (piece4Variants[0]) {
    transitionVariant(db, piece4Variants[0].id, "NEEDS_CHANGES", "human", HUMAN, {
      reviewerComments: "El hook suena genérico. Empieza por el momento concreto del fracaso.",
    });
  }

  // Pieza 5 (RexSite): creada pero sin ejecutar (estado IDEA)
  createPiece(db, { brandId: brandIds.RexSite, ideaId: ideaIds[4], topic: ideaSeeds[4].title, campaign: ideaSeeds[4].campaign, goal: ideaSeeds[4].goal, networks: ideaSeeds[4].networks }, HUMAN);

  audit(db, { actor: "sistema", action: "seed.complete", entityType: "database", entityId: "demo", details: { brands: BRAND_SEEDS.length } });
}
