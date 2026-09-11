"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { BrandDot, NetworkBadge } from "@/components/shared/network-badge";
import { fmtDateTime, fmtNumber } from "@/components/shared/format";
import { collectAllMetricsAction, collectMetricsAction, runAnalyticsAction } from "@/lib/actions/results";
import type { AnalyticsOutput } from "@/lib/agents/schemas";
import type { Brand } from "@/lib/db/schema";
import type { ResultRow } from "@/lib/queries";

export function ResultsPanel({ rows, brands, brandId }: { rows: ResultRow[]; brands: Brand[]; brandId?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [analysisBrand, setAnalysisBrand] = useState(brandId ?? brands[0]?.id ?? "");
  const [analysis, setAnalysis] = useState<AnalyticsOutput | null>(null);

  function run(promise: Promise<{ ok: boolean; message?: string; error?: string }>) {
    startTransition(async () => {
      const result = await promise;
      if (result.ok) {
        if (result.message) toast.success(result.message);
        router.refresh();
      } else toast.error(result.error);
    });
  }

  function analyze() {
    startTransition(async () => {
      const result = await runAnalyticsAction(analysisBrand);
      if (result.ok) setAnalysis(result.data ?? null);
      else toast.error(result.error);
    });
  }

  const totals = rows.reduce(
    (acc, r) => {
      if (!r.metrics) return acc;
      acc.impressions += r.metrics.impressions;
      acc.likes += r.metrics.likes;
      acc.comments += r.metrics.comments;
      acc.shares += r.metrics.shares;
      acc.clicks += r.metrics.clicks;
      return acc;
    },
    { impressions: 0, likes: 0, comments: 0, shares: 0, clicks: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-5">
        {[
          ["Impresiones", totals.impressions],
          ["Me gusta", totals.likes],
          ["Comentarios", totals.comments],
          ["Compartidos", totals.shares],
          ["Clics", totals.clicks],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="pt-6">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{fmtNumber(value as number)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => run(collectAllMetricsAction())} disabled={pending || rows.length === 0}>
          <RefreshCw /> Actualizar todas las métricas
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Sin contenido publicado" description="Cuando publiques (aunque sea simulado), aquí verás sus métricas." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Marca</TableHead>
                <TableHead>Tema</TableHead>
                <TableHead>Red</TableHead>
                <TableHead>Formato</TableHead>
                <TableHead>Publicado</TableHead>
                <TableHead className="text-right">Impresiones</TableHead>
                <TableHead className="text-right">Alcance</TableHead>
                <TableHead className="text-right">Me gusta</TableHead>
                <TableHead className="text-right">Comentarios</TableHead>
                <TableHead className="text-right">Compartidos</TableHead>
                <TableHead className="text-right">Clics</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.variantId}>
                  <TableCell><BrandDot color={r.brandColor} name={r.brandName} /></TableCell>
                  <TableCell><Link href={`/studio/${r.pieceId}`} className="font-medium hover:underline">{r.topic}</Link></TableCell>
                  <TableCell><NetworkBadge network={r.network} /></TableCell>
                  <TableCell className="text-muted-foreground">{r.format}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{fmtDateTime(r.publishedAt)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNumber(r.metrics?.impressions)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNumber(r.metrics?.reach)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNumber(r.metrics?.likes)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNumber(r.metrics?.comments)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNumber(r.metrics?.shares)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNumber(r.metrics?.clicks)}</TableCell>
                  <TableCell>
                    <Button size="icon-sm" variant="ghost" aria-label="Actualizar métricas" onClick={() => run(collectMetricsAction(r.variantId))} disabled={pending}><RefreshCw /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">AnalyticsAgent</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={analysisBrand} onValueChange={setAnalysisBrand}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Marca" /></SelectTrigger>
              <SelectContent>{brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" onClick={analyze} disabled={pending || !analysisBrand}><Sparkles /> Analizar</Button>
          </div>
        </CardHeader>
        <CardContent>
          {!analysis ? (
            <p className="text-sm text-muted-foreground">Genera un análisis para obtener aprendizajes, recomendaciones y nuevas ideas a partir de las métricas.</p>
          ) : (
            <div className="grid gap-4 text-sm md:grid-cols-2">
              <div className="md:col-span-2"><div className="font-medium">Resumen</div>{analysis.summary}</div>
              <div>
                <div className="font-medium">Mejores publicaciones</div>
                <ul className="list-disc pl-5">{analysis.topPerformers.map((t) => <li key={t.variantId}>{t.reason}</li>)}</ul>
              </div>
              <div>
                <div className="font-medium">Aprendizajes</div>
                <ul className="list-disc pl-5">{analysis.learnings.map((l, i) => <li key={i}>{l}</li>)}</ul>
              </div>
              <div>
                <div className="font-medium">Recomendaciones</div>
                <ul className="list-disc pl-5">{analysis.recommendations.map((l, i) => <li key={i}>{l}</li>)}</ul>
              </div>
              <div>
                <div className="font-medium">Ideas sugeridas</div>
                <ul className="list-disc pl-5">{analysis.suggestedIdeas.map((s, i) => <li key={i}><span className="font-medium">{s.title}</span>: {s.rationale}</li>)}</ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
