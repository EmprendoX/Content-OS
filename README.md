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

## Fase 2: contenido con un proveedor real

Objetivo de la fase: producir buen contenido con Anthropic u OpenAI. Las redes sociales siguen simuladas.

**Activar un proveedor**

1. Copia `.env.example` a `.env.local` y pega la clave (`ANTHROPIC_API_KEY` u `OPENAI_API_KEY`). Opcionalmente fija el modelo (`ANTHROPIC_MODEL`, `OPENAI_MODEL`).
2. Reinicia `npm run dev` (las variables de entorno se leen al arrancar).
3. En **Configuración → Proveedor de IA** elige el proveedor, pulsa **Probar conexión** y después **Guardar proveedor**.
4. Genera contenido desde **Ideas** o **Estudio**. En la pestaña **Agentes** de cada pieza puedes ver la entrada y la salida JSON de cada agente para depurar la calidad.

**Comandos de línea para trabajar con el proveedor**

| Comando | Qué hace |
| --- | --- |
| `npm run llm:ping` | Llamada mínima al proveedor del entorno: confirma clave, modelo y latencia |
| `npm run llm:set -- openai [modelo]` | Fija el proveedor activo de la app (equivale a Guardar proveedor en Configuración) |
| `npm run generate -- --brand "RexSite" --topic "Tema" --networks linkedin,instagram,x` | Crea una pieza, ejecuta el pipeline e imprime pieza maestra, adaptaciones y revisiones |
| `npm run regenerate -- --piece <id> --network x` | Regenera una adaptación aplicando los comentarios del revisor |

Los scripts leen `.env.local` si lo cargas en la shell (`set -a; source .env.local; set +a`).

**Rendimiento medido con `gpt-5`**

- Pipeline de 3 redes (13 llamadas): unos 9 minutos en serie con razonamiento por defecto; unos 2 minutos con adaptadores, briefs y revisiones en paralelo y `OPENAI_REASONING_EFFORT=low`.
- Regenerar una adaptación con feedback: 45-60 segundos.

**Cómo conseguir que suene a ti (lo que más influye, en orden)**

1. **Textos reales de la marca.** En Marcas, pega 3 a 5 publicaciones tuyas completas (separadas por una línea `---`). Los agentes imitan su ritmo, vocabulario y forma de abrir y cerrar.
2. **Región del español.** Cada marca tiene un dialecto (México por defecto) con guía de vocabulario; evita españolismos como "pymes", "autónomos" o "móvil".
3. **Voz y tono.** Describe cómo habla la marca con ejemplos de lo que sí y lo que no.
4. **Regla anti-IA.** Los prompts prohíben el formato telegráfico (etiquetas tipo "Error 1:", flechas, listas de fragmentos) y una lista de muletillas; el revisor detecta esas señales de forma determinista y bloquea la pieza.
5. **Reintento de longitud.** Si una adaptación excede el límite de la red (por ejemplo, un post de X de más de 270 caracteres), el orquestador pide una corrección puntual antes de revisar.

**Qué cambia respecto a la fase 1**

- Prompts con brief de marca legible, reglas de estilo (sin frases genéricas, sin promesas, una idea por pieza) y un playbook por red (`src/lib/agents/prompts.ts`).
- Regenerar una adaptación envía al agente los comentarios del revisor y el intento anterior, y le exige explicar qué cambió.
- El `ReviewAgent` combina la rúbrica del modelo con comprobaciones deterministas: palabras y promesas prohibidas, frases genéricas, longitud por red (y por post en X), rango de hashtags, longitud del hook y exceso de emojis.
- El adaptador de OpenAI usa `max_completion_tokens` y omite `temperature` en modelos de razonamiento (`gpt-5*`, `o*`).

## Próximas fases

- Fase 3: conectores reales por red y métricas reales. No se conectará ninguna API social hasta que el flujo de aprobación esté validado.
