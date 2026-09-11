"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Play, RefreshCw, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { StateBadge } from "@/components/shared/state-badge";
import { BrandDot, NetworkBadge } from "@/components/shared/network-badge";
import { fmtDateTime } from "@/components/shared/format";
import { markPieceReadyAction, runPipelineAction } from "@/lib/actions/studio";
import type { AgentRun, Brand, ContentPiece, ContentVariant, MediaAsset, PublishJob, VariantVersion } from "@/lib/db/schema";
import type { MasterOutput, ResearchOutput, StrategyOutput, EditorChiefOutput } from "@/lib/agents/schemas";
import { VariantEditor } from "./variant-editor";

interface PieceDetailProps {
  piece: ContentPiece;
  brand: Brand;
  variants: ContentVariant[];
  runs: AgentRun[];
  versions: VariantVersion[];
  jobs: PublishJob[];
  assets: MediaAsset[];
  publishingEnabled: boolean;
  globalDryRun: boolean;
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ul>
  );
}

export function PieceDetail({ piece, brand, variants, runs, versions, jobs, assets, publishingEnabled, globalDryRun }: PieceDetailProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const research = piece.research as ResearchOutput | null;
  const strategy = piece.strategy as StrategyOutput | null;
  const master = piece.master as MasterOutput | null;
  const editor = piece.editorDecision as EditorChiefOutput | null;
  const canRun = piece.status === "IDEA" || piece.status === "FAILED" || piece.status === "NEEDS_CHANGES";

  function run() {
    startTransition(async () => {
      const result = await runPipelineAction(piece.id);
      if (result.ok) {
        toast.success(`Pipeline terminado: ${result.data!.status}`);
        router.refresh();
      } else toast.error(result.error);
    });
  }

  function markReady() {
    startTransition(async () => {
      const result = await markPieceReadyAction(piece.id);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else toast.error(result.error);
    });
  }

  return (
    <div>
      <Link href="/studio" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Estudio
      </Link>
      <PageHeader
        title={piece.topic}
        description={`${brand.name}${piece.campaign ? ` · ${piece.campaign}` : ""}${piece.goal ? ` · Objetivo: ${piece.goal}` : ""}`}
        actions={
          <>
            <StateBadge state={piece.status} className="h-6 px-2.5" />
            {canRun && (
              <Button onClick={run} disabled={pending}>
                <Play /> {piece.status === "NEEDS_CHANGES" ? "Regenerar adaptaciones" : "Ejecutar pipeline"}
              </Button>
            )}
            {piece.status === "NEEDS_CHANGES" && (
              <Button variant="outline" onClick={markReady} disabled={pending}>
                <CheckCheck /> Marcar como listo
              </Button>
            )}
          </>
        }
      />

      {piece.error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          Último error: {piece.error}
        </div>
      )}

      {editor && (
        <Card className="mb-6">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
            <div>
              <span className="font-medium">EditorChiefAgent:</span> {editor.summary}
            </div>
            <Badge variant={editor.overallDecision === "READY_FOR_APPROVAL" ? "default" : "secondary"}>
              Recomendación: {editor.overallDecision === "READY_FOR_APPROVAL" ? "pasar a aprobación" : "requiere cambios"}
            </Badge>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="variants">
        <TabsList>
          <TabsTrigger value="variants">Adaptaciones ({variants.length})</TabsTrigger>
          <TabsTrigger value="master">Pieza maestra</TabsTrigger>
          <TabsTrigger value="strategy">Estrategia</TabsTrigger>
          <TabsTrigger value="research">Investigación</TabsTrigger>
          <TabsTrigger value="runs">Agentes ({runs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="variants" className="mt-4 space-y-4">
          {variants.length === 0 && (
            <p className="text-sm text-muted-foreground">Todavía no hay adaptaciones. Ejecuta el pipeline.</p>
          )}
          {variants.map((variant) => (
            <VariantEditor
              key={variant.id}
              variant={variant}
              brandId={brand.id}
              versions={versions.filter((v) => v.variantId === variant.id)}
              jobs={jobs.filter((j) => j.variantId === variant.id)}
              assets={assets}
              publishingEnabled={publishingEnabled}
              globalDryRun={globalDryRun}
            />
          ))}
        </TabsContent>

        <TabsContent value="master" className="mt-4">
          {master ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{master.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{master.wordCount} palabras</p>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div><span className="font-medium">Hook:</span> {master.hook}</div>
                <div className="whitespace-pre-wrap rounded-md bg-muted/50 p-3">{master.body}</div>
                <div><span className="font-medium">Mensaje clave:</span> {master.keyMessage}</div>
                <div><span className="font-medium">CTA:</span> {master.cta}</div>
                {master.proofPointsUsed.length > 0 && <div><span className="font-medium">Pruebas usadas:</span> {master.proofPointsUsed.join(" · ")}</div>}
              </CardContent>
            </Card>
          ) : <p className="text-sm text-muted-foreground">Sin pieza maestra todavía.</p>}
        </TabsContent>

        <TabsContent value="strategy" className="mt-4">
          {strategy ? (
            <Card>
              <CardContent className="grid gap-4 pt-6 text-sm md:grid-cols-2">
                <div><div className="font-medium">Objetivo</div>{strategy.objective}</div>
                <div><div className="font-medium">Mensaje central</div>{strategy.coreMessage}</div>
                <div><div className="font-medium">Ángulo</div>{strategy.angle}</div>
                <div><div className="font-medium">Pilar</div>{strategy.contentPillar}</div>
                <div className="md:col-span-2"><div className="font-medium">Puntos clave</div><List items={strategy.keyPoints} /></div>
                <div className="md:col-span-2"><div className="font-medium">Notas de tono</div>{strategy.toneNotes}</div>
                <div className="md:col-span-2">
                  <div className="mb-2 font-medium">Plan por red</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {strategy.networkPlan.map((p) => (
                      <div key={p.network} className="rounded-md border border-border p-3">
                        <div className="flex items-center justify-between"><NetworkBadge network={p.network} /><span className="text-xs text-muted-foreground">Prioridad {p.priority}</span></div>
                        <div className="mt-1">{p.format} · {p.objective}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : <p className="text-sm text-muted-foreground">Sin estrategia todavía.</p>}
        </TabsContent>

        <TabsContent value="research" className="mt-4">
          {research ? (
            <Card>
              <CardContent className="grid gap-4 pt-6 text-sm md:grid-cols-2">
                <div className="md:col-span-2"><div className="font-medium">Resumen</div>{research.summary}</div>
                <div><div className="font-medium">Insights</div><List items={research.keyInsights} /></div>
                <div><div className="font-medium">Dolores de la audiencia</div><List items={research.audiencePains} /></div>
                <div><div className="font-medium">Ángulos</div><List items={research.angles} /></div>
                <div><div className="font-medium">Riesgos</div><List items={research.risks} /></div>
                {research.sources.length > 0 && (
                  <div className="md:col-span-2"><div className="font-medium">Fuentes de la biblioteca</div><List items={research.sources.map((s) => `${s.title}: ${s.note}`)} /></div>
                )}
              </CardContent>
            </Card>
          ) : <p className="text-sm text-muted-foreground">Sin investigación todavía.</p>}
        </TabsContent>

        <TabsContent value="runs" className="mt-4">
          <div className="space-y-2">
            {runs.map((run) => (
              <details key={run.id} className="rounded-md border border-border px-3 py-2 text-sm">
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Badge variant={run.status === "exito" ? "secondary" : "destructive"}>{run.status}</Badge>
                    <span className="font-medium">{run.agent}</span>
                    <span className="text-xs text-muted-foreground">{run.provider} · {run.durationMs} ms</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{fmtDateTime(run.createdAt)}</span>
                </summary>
                {run.error && <div className="mt-2 text-xs text-red-700">{run.error}</div>}
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <div>
                    <div className="mb-1 text-xs font-medium">Entrada (JSON validado)</div>
                    <pre className="max-h-72 overflow-auto rounded bg-muted/50 p-2 text-[11px]">{JSON.stringify(run.input, null, 2)}</pre>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium">Salida (JSON validado)</div>
                    <pre className="max-h-72 overflow-auto rounded bg-muted/50 p-2 text-[11px]">{JSON.stringify(run.output, null, 2)}</pre>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-8 text-xs text-muted-foreground">
        <BrandDot color={brand.color} name={brand.name} /> · Creado {fmtDateTime(piece.createdAt)}
        {pending && <span className="ml-2 inline-flex items-center gap-1"><RefreshCw className="size-3 animate-spin" /> Procesando…</span>}
      </div>
    </div>
  );
}
