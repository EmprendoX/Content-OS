# Content OS

Dashboard editorial local, privado y de un solo usuario. Un conjunto de agentes de IA investiga, planifica, crea, adapta y revisa contenido para varias redes sociales. **Nada se publica sin aprobación humana explícita.**

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui
- SQLite local con Drizzle ORM
- Zod valida todas las entradas y salidas de los agentes
- Solo accesible desde `localhost`; sin login, registro ni multiusuario
- Fase 1: proveedor de IA **Mock** y conectores sociales **simulados** (Dry Run)

## Instalación

Requisitos: Node.js 22 o superior y npm.

```bash
npm install
cp .env.example .env.local   # opcional: todo funciona con los valores por defecto
npm run setup                # aplica migraciones y crea los datos de demostración
npm run dev
```

Abre <http://127.0.0.1:3000>. La aplicación rechaza cualquier host que no sea `localhost`, `127.0.0.1` o `::1`.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo en `127.0.0.1:3000` |
| `npm run build` / `npm start` | Compilación y arranque en producción (sigue siendo local) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest (máquina de estados, bloqueo de publicación, cifrado, orquestador) |
| `npm run db:generate` | Genera una migración a partir de `src/lib/db/schema.ts` |
| `npm run db:migrate` | Aplica migraciones a `./data/content-os.db` |
| `npm run db:seed` | Carga datos de demostración (si la base está vacía) |
| `npm run db:reset` | Borra la base de datos y regenera la demo |
| `npm run setup` | `db:migrate` + `db:seed` |

## Módulos

1. **Dashboard**: pendiente de revisar, calendario semanal, estado del flujo, publicaciones fallidas, resultados recientes.
2. **Marcas**: espacios separados (RexSite, IMPULSE, Propaganda Inteligente, Marca personal y las que crees) con descripción, productos, audiencias, voz y tono, ofertas, CTAs, pruebas autorizadas, palabras preferidas y prohibidas, promesas prohibidas, ejemplos aprobados y redes asociadas.
3. **Biblioteca de conocimiento**: única fuente que usa el `ResearchAgent`.
4. **Ideas**: un clic convierte una idea en pieza maestra y adaptaciones.
5. **Estudio de contenido**: investigación, estrategia, pieza maestra, adaptaciones editables, brief visual, revisión, historial de versiones y ejecuciones de agentes.
6. **Hoja de aprobación**: vista tipo spreadsheet con edición directa, selección múltiple, filtros, aprobación individual y por lote, programación, publicación con confirmación y exportación CSV.
7. **Calendario**: vista semanal de programado y publicado.
8. **Conexiones sociales**: conectores simulados, tokens cifrados, Dry Run por conexión y registro de cada intento (payload, respuesta, error, intentos).
9. **Resultados**: métricas (simuladas) y `AnalyticsAgent`.
10. **Configuración**: interruptor global de publicaciones, Dry Run global, proveedor de IA, seguridad y auditoría.

## Flujo de agentes

`ResearchAgent → StrategyAgent → MasterContentAgent → {Instagram, Facebook, LinkedIn, X, YouTube}Adapter → VisualBriefAgent → ReviewAgent → EditorChiefAgent`

- Todos intercambian objetos JSON validados con Zod (`src/lib/agents/schemas.ts`).
- El contenido parte de una **pieza maestra**; cada adaptador produce una versión distinta según formato, extensión y tono de la red.
- `EditorChiefAgent` solo puede recomendar `READY_FOR_APPROVAL` o `NEEDS_CHANGES`. Su esquema excluye `APPROVED`.
- `PublisherAgent` es determinista (sin IA) y solo procesa `APPROVED` o `SCHEDULED`.
- `AnalyticsAgent` analiza métricas y sugiere ideas.

## Estados

```
IDEA → RESEARCHING → MASTER_DRAFT → ADAPTING → IN_REVIEW → NEEDS_CHANGES | READY_FOR_APPROVAL
READY_FOR_APPROVAL → APPROVED (solo humano) → SCHEDULED (solo humano) → PUBLISHING → PUBLISHED | FAILED
```

La máquina de estados vive en `src/lib/workflow/states.ts`. `assertTransition` comprueba la transición y el actor: solo `human` puede asignar `APPROVED` o `SCHEDULED`; solo `system` puede asignar `PUBLISHING` o `PUBLISHED`.

## Seguridad

- **Tokens cifrados** con AES-256-GCM. Clave en `CONTENT_OS_ENCRYPTION_KEY` o generada en `data/.encryption-key` (0600).
- Los tokens nunca se envían a los agentes ni aparecen en prompts; solo el conector los recibe descifrados en el momento de publicar.
- **Auditoría** de cada transición, aprobación, publicación, edición y cambio de configuración.
- **Historial de versiones**: cada edición o regeneración guarda una instantánea; no se borra nada.
- **Confirmación** antes de cada publicación y antes de activar el interruptor global.
- **Interruptor global** que bloquea cualquier publicación, incluidas las programadas.
- Generación y publicación viven en módulos separados (`src/lib/agents` y `src/lib/social`).

## Proveedores de IA

Interfaz `LLMProvider` en `src/lib/llm/provider.ts`. Adaptadores: `mock`, `anthropic`, `openai`, `ollama`. Se elige en Configuración; las claves solo se leen del entorno (`.env.local`).

## Estructura

```
src/app/            páginas (App Router) y rutas API (CSV, multimedia)
src/components/     UI por módulo + shadcn/ui
src/lib/agents/     esquemas Zod, agentes, orquestador
src/lib/llm/        LLMProvider y adaptadores
src/lib/social/     SocialConnector, conectores simulados, PublisherAgent
src/lib/workflow/   máquina de estados y transiciones
src/lib/security/   cifrado y auditoría
src/lib/db/         esquema Drizzle, cliente, seed
src/lib/actions/    server actions
drizzle/            migraciones SQL
data/               base de datos, multimedia y clave (ignorado por git)
tests/              Vitest
```

## Próximas fases

- Fase 2: proveedores reales probados end to end, cola de programación con ejecución automática.
- Fase 3: conectores reales por red y métricas reales. No se conectará ninguna API social hasta que el flujo de aprobación esté validado.
