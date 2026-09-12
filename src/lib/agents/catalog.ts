/** Lista de agentes para la interfaz y la documentación. Sin dependencias de servidor. */
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
