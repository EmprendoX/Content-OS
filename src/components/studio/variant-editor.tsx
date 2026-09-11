"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { History, RefreshCw, Save, Send, ThumbsDown, ThumbsUp, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StateBadge } from "@/components/shared/state-badge";
import { NetworkBadge } from "@/components/shared/network-badge";
import { fmtDateTime } from "@/components/shared/format";
import { regenerateVariantAction, updateVariantAction } from "@/lib/actions/studio";
import { approveVariantsAction, publishNowAction, rejectVariantAction, retryFailedAction } from "@/lib/actions/approvals";
import { uploadMediaAction } from "@/lib/actions/media";
import { NETWORK_SPECS } from "@/lib/networks";
import type { ContentVariant, MediaAsset, PublishJob, VariantVersion } from "@/lib/db/schema";
import type { ReviewOutput, VisualBriefOutput } from "@/lib/agents/schemas";

interface Props {
  variant: ContentVariant;
  brandId: string;
  versions: VariantVersion[];
  jobs: PublishJob[];
  assets: MediaAsset[];
  publishingEnabled: boolean;
  globalDryRun: boolean;
}

export function VariantEditor({ variant, brandId, versions, jobs, assets, publishingEnabled, globalDryRun }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showHistory, setShowHistory] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState(variant.reviewerComments);
  const review = variant.review as ReviewOutput | null;
  const brief = variant.visualBrief as VisualBriefOutput | null;
  const spec = NETWORK_SPECS[variant.network];
  const locked = variant.status === "PUBLISHED" || variant.status === "PUBLISHING";
  const canApprove = variant.status === "READY_FOR_APPROVAL" || variant.status === "NEEDS_CHANGES";
  const canPublish = variant.status === "APPROVED" || variant.status === "SCHEDULED";

  function handle(promise: Promise<{ ok: boolean; message?: string; error?: string }>, after?: () => void) {
    startTransition(async () => {
      const result = await promise;
      if (result.ok) {
        toast.success(result.message ?? "Hecho.");
        after?.();
        router.refresh();
      } else toast.error(result.error);
    });
  }

  function onSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handle(updateVariantAction(new FormData(event.currentTarget)));
  }

  function onUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    form.set("brandId", brandId);
    form.set("variantId", variant.id);
    handle(uploadMediaAction(form));
    event.target.value = "";
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <NetworkBadge network={variant.network} />
          <StateBadge state={variant.status} />
          <span className="text-xs text-muted-foreground">{variant.format} · v{variant.version} · {variant.copy.length}/{spec.maxChars} caracteres</span>
          {review && (
            <Badge variant={review.passed ? "secondary" : "destructive"}>Revisión {review.score}/100</Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setShowHistory((s) => !s)}>
            <History /> Versiones ({versions.length})
          </Button>
          {!locked && (
            <Button size="sm" variant="outline" onClick={() => handle(regenerateVariantAction(variant.id))} disabled={pending}>
              <RefreshCw /> Regenerar
            </Button>
          )}
          {canApprove && (
            <>
              <Button size="sm" variant="outline" onClick={() => setRejectOpen(true)} disabled={pending}>
                <ThumbsDown /> Pedir cambios
              </Button>
              <Button size="sm" onClick={() => handle(approveVariantsAction([variant.id]))} disabled={pending}>
                <ThumbsUp /> Aprobar
              </Button>
            </>
          )}
          {canPublish && (
            <Button size="sm" onClick={() => setPublishOpen(true)} disabled={pending}>
              <Send /> Publicar ahora
            </Button>
          )}
          {variant.status === "FAILED" && (
            <Button size="sm" variant="outline" onClick={() => handle(retryFailedAction(variant.id))} disabled={pending}>
              Reintentar (volver a aprobado)
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <form onSubmit={onSave} className="space-y-3">
          <input type="hidden" name="id" value={variant.id} />
          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
            <div className="space-y-1.5">
              <Label>Hook</Label>
              <Input name="hook" defaultValue={variant.hook} disabled={locked} />
            </div>
            <div className="space-y-1.5">
              <Label>Formato</Label>
              <Select name="format" defaultValue={variant.format} disabled={locked}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[variant.format, ...spec.formats.filter((f) => f !== variant.format)].map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Copy</Label>
            <Textarea name="copy" rows={10} defaultValue={variant.copy} disabled={locked} className="font-mono text-xs" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>CTA</Label>
              <Input name="cta" defaultValue={variant.cta} disabled={locked} />
            </div>
            <div className="space-y-1.5">
              <Label>Hashtags</Label>
              <Input name="hashtags" defaultValue={variant.hashtags.join(" ")} disabled={locked} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Comentarios del revisor</Label>
            <Textarea name="reviewerComments" rows={2} defaultValue={variant.reviewerComments} />
          </div>
          <div className="space-y-1.5">
            <Label>Archivo visual</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Select name="visualAssetId" defaultValue={variant.visualAssetId ?? "none"} disabled={locked}>
                <SelectTrigger className="w-64"><SelectValue placeholder="Sin archivo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin archivo</SelectItem>
                  {assets.map((a) => <SelectItem key={a.id} value={a.id}>{a.filename}</SelectItem>)}
                </SelectContent>
              </Select>
              {!locked && (
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-muted">
                  <ImageIcon className="size-4" /> Subir
                  <input type="file" className="hidden" accept="image/*,video/mp4,application/pdf" onChange={onUpload} />
                </label>
              )}
              {variant.visualAssetId && (
                <a href={`/api/media/${variant.visualAssetId}`} target="_blank" rel="noreferrer" className="text-xs text-primary underline">Ver</a>
              )}
            </div>
          </div>
          {!locked && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox name="rereview" /> Volver a pasar por ReviewAgent al guardar
              </label>
              <Button type="submit" size="sm" disabled={pending}><Save /> Guardar nueva versión</Button>
            </div>
          )}
        </form>

        <div className="space-y-4 text-sm">
          {review && (
            <div className="rounded-md border border-border p-3">
              <div className="mb-1 font-medium">ReviewAgent</div>
              {review.issues.length === 0 ? (
                <p className="text-muted-foreground">Sin problemas detectados.</p>
              ) : (
                <ul className="space-y-1">
                  {review.issues.map((i, idx) => (
                    <li key={idx} className="flex gap-2">
                      <Badge variant={i.severity === "alta" ? "destructive" : "outline"} className="shrink-0">{i.severity}</Badge>
                      <span>{i.message}</span>
                    </li>
                  ))}
                </ul>
              )}
              {review.suggestions.length > 0 && (
                <ul className="mt-2 list-disc space-y-0.5 pl-4 text-muted-foreground">
                  {review.suggestions.map((s, idx) => <li key={idx}>{s}</li>)}
                </ul>
              )}
            </div>
          )}
          {brief && (
            <div className="rounded-md border border-border p-3">
              <div className="mb-1 font-medium">Brief visual</div>
              <p>{brief.concept}</p>
              <p className="mt-1 text-muted-foreground">{brief.aspectRatio} · {brief.style}</p>
              <p className="mt-1"><span className="text-muted-foreground">Texto en imagen:</span> {brief.textOverlay}</p>
              <p className="mt-1"><span className="text-muted-foreground">Alt:</span> {brief.altText}</p>
              <div className="mt-2 flex gap-1">
                {brief.colorPalette.map((c) => <span key={c} className="size-4 rounded border" style={{ backgroundColor: c }} title={c} />)}
              </div>
            </div>
          )}
          {(variant.scheduledAt || variant.publishedUrl) && (
            <div className="rounded-md border border-border p-3">
              {variant.scheduledAt && <div>Programado: {fmtDateTime(variant.scheduledAt)}</div>}
              {variant.publishedUrl && (
                <div>Publicado: <a href={variant.publishedUrl} className="text-primary underline" target="_blank" rel="noreferrer">{variant.publishedUrl}</a></div>
              )}
            </div>
          )}
          {jobs.length > 0 && (
            <div className="rounded-md border border-border p-3">
              <div className="mb-1 font-medium">Intentos de publicación</div>
              <ul className="space-y-1 text-xs">
                {jobs.map((j) => (
                  <li key={j.id} className="flex items-center justify-between gap-2">
                    <span><Badge variant={j.status === "exito" ? "secondary" : j.status === "fallido" ? "destructive" : "outline"}>{j.status}</Badge> {j.dryRun ? "dry run" : "real (simulado)"} · intento {j.attempts}</span>
                    <span className="text-muted-foreground">{fmtDateTime(j.executedAt ?? j.createdAt)}</span>
                    {j.error && <span className="w-full text-red-700">{j.error}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>

      {showHistory && (
        <CardContent className="border-t border-border pt-4">
          <div className="mb-2 text-sm font-medium">Historial de versiones (nunca se borran)</div>
          <div className="space-y-2">
            {versions.map((v) => {
              const snap = v.snapshot as { hook: string; copy: string; status: string };
              return (
                <details key={v.id} className="rounded-md border border-border px-3 py-2 text-sm">
                  <summary className="cursor-pointer">
                    v{v.version} · {v.reason} · {v.actor} · {fmtDateTime(v.createdAt)}
                  </summary>
                  <div className="mt-2 text-xs"><span className="font-medium">Hook:</span> {snap.hook}</div>
                  <pre className="mt-1 whitespace-pre-wrap rounded bg-muted/50 p-2 text-xs">{snap.copy}</pre>
                </details>
              );
            })}
          </div>
        </CardContent>
      )}

      <ConfirmDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        title="Confirmar publicación"
        description={
          !publishingEnabled
            ? "Las publicaciones están desactivadas globalmente. Actívalas en Configuración para continuar."
            : globalDryRun
              ? "Dry Run global activo: se validará y registrará el payload, pero no se enviará nada."
              : "Se enviará esta adaptación al conector simulado de la red. Esta acción queda registrada en auditoría."
        }
        confirmLabel={globalDryRun ? "Ejecutar Dry Run" : "Publicar"}
        pending={pending}
        onConfirm={() => handle(publishNowAction(variant.id, true), () => setPublishOpen(false))}
      >
        <div className="rounded-md bg-muted/50 p-3 text-xs">
          <div className="font-medium">{spec.label} · {variant.format}</div>
          <div className="mt-1 line-clamp-4 whitespace-pre-wrap">{variant.copy}</div>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Pedir cambios"
        description="Escribe qué debe corregirse. La variante volverá a 'Requiere cambios'."
        confirmLabel="Devolver a cambios"
        pending={pending}
        onConfirm={() => handle(rejectVariantAction(variant.id, rejectComment), () => setRejectOpen(false))}
      >
        <Textarea rows={3} value={rejectComment} onChange={(e) => setRejectComment(e.target.value)} />
      </ConfirmDialog>
    </Card>
  );
}
