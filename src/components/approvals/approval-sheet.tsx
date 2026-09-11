"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CheckCheck, Download, PlayCircle, Send, ThumbsDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StateBadge } from "@/components/shared/state-badge";
import { BrandDot, NetworkBadge } from "@/components/shared/network-badge";
import { fmtDate, fmtNumber, toLocalInput } from "@/components/shared/format";
import { approveVariantsAction, publishNowAction, rejectVariantAction, runDueAction, scheduleVariantAction, updateCellAction } from "@/lib/actions/approvals";
import { NETWORK_SPECS, NETWORKS } from "@/lib/networks";
import { CONTENT_STATES, STATE_LABELS } from "@/lib/workflow/states";
import type { ApprovalRow } from "@/lib/queries";
import type { Brand } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

interface Props {
  rows: ApprovalRow[];
  brands: Brand[];
  filters: { brandId: string; status: string; network: string };
  publishingEnabled: boolean;
  globalDryRun: boolean;
}

type CellField = "hook" | "copy" | "cta" | "format" | "reviewerComments" | "campaign";

function EditableCell({ value, field, rowId, locked, multiline, onSave, className }: { value: string; field: CellField; rowId: string; locked: boolean; multiline?: boolean; onSave: (rowId: string, field: CellField, value: string) => void; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (locked) return <div className={cn("whitespace-pre-wrap text-xs", className)}>{value || "—"}</div>;

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setDraft(value); setEditing(true); }}
        className={cn("block w-full whitespace-pre-wrap rounded px-1 py-0.5 text-left text-xs hover:bg-muted", className)}
        title="Clic para editar"
      >
        {value || <span className="text-muted-foreground">—</span>}
      </button>
    );
  }

  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(rowId, field, draft);
  };

  return multiline ? (
    <Textarea autoFocus rows={5} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} className="min-w-64 text-xs" onKeyDown={(e) => { if (e.key === "Escape") setEditing(false); }} />
  ) : (
    <Input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} className="h-7 min-w-40 text-xs" onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }} />
  );
}

export function ApprovalSheet({ rows, brands, filters, publishingEnabled, globalDryRun }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectText, setRejectText] = useState("");
  const [publishId, setPublishId] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => [r.topic, r.hook, r.copy, r.campaign, r.brandName].some((t) => t.toLowerCase().includes(q)));
  }, [rows, search]);

  const selectedRows = visible.filter((r) => selected.has(r.id));
  const approvable = selectedRows.filter((r) => r.status === "READY_FOR_APPROVAL" || r.status === "NEEDS_CHANGES");
  const allSelected = visible.length > 0 && visible.every((r) => selected.has(r.id));

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams();
    const next = { ...filters, [key]: value === "all" ? "" : value };
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
    router.push(`${pathname}?${params.toString()}`);
  }

  function run(promise: Promise<{ ok: boolean; message?: string; error?: string }>, after?: () => void) {
    startTransition(async () => {
      const result = await promise;
      if (result.ok) {
        if (result.message) toast.success(result.message);
        after?.();
        router.refresh();
      } else toast.error(result.error);
    });
  }

  const saveCell = (rowId: string, field: CellField, value: string) => run(updateCellAction(rowId, field, value));

  const exportUrl = () => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
    if (selected.size > 0) params.set("ids", [...selected].join(","));
    return `/api/export/approvals?${params.toString()}`;
  };

  const publishRow = rows.find((r) => r.id === publishId);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filters.brandId || "all"} onValueChange={(v) => setFilter("brandId", v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Marca" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las marcas</SelectItem>
            {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.status || "all"} onValueChange={(v) => setFilter("status", v)}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {CONTENT_STATES.map((s) => <SelectItem key={s} value={s}>{STATE_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.network || "all"} onValueChange={(v) => setFilter("network", v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Red" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las redes</SelectItem>
            {NETWORKS.map((n) => <SelectItem key={n} value={n}>{NETWORK_SPECS[n].label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-52" />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => run(runDueAction())} disabled={pending || !publishingEnabled} title={publishingEnabled ? "Publica las programadas con fecha vencida" : "Publicaciones desactivadas"}>
            <PlayCircle /> Procesar programadas
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={exportUrl()} download><Download /> Exportar CSV{selected.size > 0 ? ` (${selected.size})` : ""}</a>
          </Button>
          <Button size="sm" onClick={() => setBulkOpen(true)} disabled={pending || approvable.length === 0}>
            <CheckCheck /> Aprobar seleccionadas ({approvable.length})
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table className="min-w-[1900px] table-fixed text-xs">
          <TableHeader className="sticky top-0 bg-muted/60">
            <TableRow>
              <TableHead className="w-8">
                <Checkbox checked={allSelected} onCheckedChange={(c) => setSelected(c ? new Set(visible.map((r) => r.id)) : new Set())} aria-label="Seleccionar todo" />
              </TableHead>
              <TableHead className="w-24">Fecha</TableHead>
              <TableHead className="w-32">Marca</TableHead>
              <TableHead className="w-32">Campaña</TableHead>
              <TableHead className="w-48">Tema</TableHead>
              <TableHead className="w-24">Red</TableHead>
              <TableHead className="w-24">Formato</TableHead>
              <TableHead className="w-56">Hook</TableHead>
              <TableHead className="w-80">Copy</TableHead>
              <TableHead className="w-40">CTA</TableHead>
              <TableHead className="w-32">Archivo visual</TableHead>
              <TableHead className="w-48">Comentarios del revisor</TableHead>
              <TableHead className="w-36">Estado</TableHead>
              <TableHead className="w-44">Fecha programada</TableHead>
              <TableHead className="w-40">Enlace publicado</TableHead>
              <TableHead className="w-40">Métricas</TableHead>
              <TableHead className="w-44">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && (
              <TableRow><TableCell colSpan={17} className="py-10 text-center text-muted-foreground">No hay filas con estos filtros.</TableCell></TableRow>
            )}
            {visible.map((row) => {
              const locked = row.status === "PUBLISHED" || row.status === "PUBLISHING";
              const isSelected = selected.has(row.id);
              return (
                <TableRow key={row.id} data-state={isSelected ? "selected" : undefined} className="align-top">
                  <TableCell>
                    <Checkbox checked={isSelected} onCheckedChange={(c) => setSelected((prev) => { const n = new Set(prev); if (c) n.add(row.id); else n.delete(row.id); return n; })} aria-label="Seleccionar fila" />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{fmtDate(row.date)}</TableCell>
                  <TableCell><BrandDot color={row.brandColor} name={row.brandName} className="text-xs" /></TableCell>
                  <TableCell><EditableCell value={row.campaign} field="campaign" rowId={row.id} locked={locked} onSave={saveCell} /></TableCell>
                  <TableCell><Link href={`/studio/${row.pieceId}`} className="font-medium hover:underline">{row.topic}</Link></TableCell>
                  <TableCell><NetworkBadge network={row.network} /></TableCell>
                  <TableCell><EditableCell value={row.format} field="format" rowId={row.id} locked={locked} onSave={saveCell} /></TableCell>
                  <TableCell><EditableCell value={row.hook} field="hook" rowId={row.id} locked={locked} onSave={saveCell} /></TableCell>
                  <TableCell><EditableCell value={row.copy} field="copy" rowId={row.id} locked={locked} multiline onSave={saveCell} className="line-clamp-6" /></TableCell>
                  <TableCell><EditableCell value={row.cta} field="cta" rowId={row.id} locked={locked} onSave={saveCell} /></TableCell>
                  <TableCell>
                    {row.visualAssetId ? (
                      <a href={`/api/media/${row.visualAssetId}`} target="_blank" rel="noreferrer" className="text-primary underline">{row.visualAssetName}</a>
                    ) : <Link href={`/studio/${row.pieceId}`} className="text-muted-foreground hover:underline">Añadir</Link>}
                  </TableCell>
                  <TableCell><EditableCell value={row.reviewerComments} field="reviewerComments" rowId={row.id} locked={false} multiline onSave={saveCell} /></TableCell>
                  <TableCell>
                    <StateBadge state={row.status} />
                    {row.reviewScore !== null && <div className="mt-1 text-muted-foreground">Revisión {row.reviewScore}</div>}
                  </TableCell>
                  <TableCell>
                    {row.status === "APPROVED" || row.status === "SCHEDULED" ? (
                      <Input
                        type="datetime-local"
                        defaultValue={toLocalInput(row.scheduledAt)}
                        className="h-7 text-xs"
                        onBlur={(e) => {
                          const v = e.target.value;
                          const current = toLocalInput(row.scheduledAt);
                          if (v !== current) run(scheduleVariantAction(row.id, v ? new Date(v).toISOString() : null));
                        }}
                      />
                    ) : <span className="text-muted-foreground">{row.scheduledAt ? fmtDate(row.scheduledAt, "d MMM HH:mm") : "—"}</span>}
                  </TableCell>
                  <TableCell>
                    {row.publishedUrl ? <a href={row.publishedUrl} target="_blank" rel="noreferrer" className="break-all text-primary underline">{row.publishedUrl.replace(/^https?:\/\//, "")}</a> : "—"}
                  </TableCell>
                  <TableCell>
                    {row.metrics ? (
                      <div className="space-y-0.5 text-muted-foreground">
                        <div>👁 {fmtNumber(row.metrics.impressions)} · ♥ {fmtNumber(row.metrics.likes)}</div>
                        <div>💬 {fmtNumber(row.metrics.comments)} · ↗ {fmtNumber(row.metrics.shares)}</div>
                      </div>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(row.status === "READY_FOR_APPROVAL" || row.status === "NEEDS_CHANGES") && (
                        <>
                          <Button size="xs" onClick={() => run(approveVariantsAction([row.id]))} disabled={pending}>Aprobar</Button>
                          <Button size="xs" variant="outline" onClick={() => { setRejectId(row.id); setRejectText(row.reviewerComments); }} disabled={pending}><ThumbsDown /></Button>
                        </>
                      )}
                      {(row.status === "APPROVED" || row.status === "SCHEDULED") && (
                        <>
                          <Button size="xs" onClick={() => setPublishId(row.id)} disabled={pending}><Send /> Publicar</Button>
                          <Button size="xs" variant="outline" onClick={() => run(rejectVariantAction(row.id, "Aprobación revocada por el revisor."))} disabled={pending}>Revocar</Button>
                        </>
                      )}
                      {row.status === "FAILED" && (
                        <Button asChild size="xs" variant="outline"><Link href={`/studio/${row.pieceId}`}>Revisar</Link></Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">{visible.length} filas · {selected.size} seleccionadas. Editar una celda de contenido aprobado devuelve la fila a “Requiere cambios”.</p>

      <ConfirmDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title={`Aprobar ${approvable.length} adaptaciones`}
        description="Confirmas que has revisado cada una. La aprobación queda registrada en auditoría."
        confirmLabel="Aprobar todas"
        pending={pending}
        onConfirm={() => run(approveVariantsAction(approvable.map((r) => r.id)), () => { setBulkOpen(false); setSelected(new Set()); })}
      >
        <ul className="max-h-48 space-y-1 overflow-auto text-sm">
          {approvable.map((r) => <li key={r.id} className="flex items-center gap-2"><NetworkBadge network={r.network} /> {r.topic}</li>)}
        </ul>
      </ConfirmDialog>

      <ConfirmDialog
        open={rejectId !== null}
        onOpenChange={(o) => !o && setRejectId(null)}
        title="Pedir cambios"
        confirmLabel="Devolver a cambios"
        pending={pending}
        onConfirm={() => rejectId && run(rejectVariantAction(rejectId, rejectText), () => setRejectId(null))}
      >
        <Textarea rows={3} value={rejectText} onChange={(e) => setRejectText(e.target.value)} placeholder="Qué debe corregirse" />
      </ConfirmDialog>

      <ConfirmDialog
        open={publishId !== null}
        onOpenChange={(o) => !o && setPublishId(null)}
        title="Confirmar publicación"
        description={
          !publishingEnabled
            ? "Las publicaciones están desactivadas globalmente. Actívalas en Configuración."
            : globalDryRun
              ? "Dry Run global activo: se validará y registrará el payload sin enviar nada."
              : "Se enviará al conector simulado. Queda registrado en auditoría."
        }
        confirmLabel={globalDryRun ? "Ejecutar Dry Run" : "Publicar"}
        pending={pending}
        onConfirm={() => publishId && run(publishNowAction(publishId, true), () => setPublishId(null))}
      >
        {publishRow && (
          <div className="rounded-md bg-muted/50 p-3 text-xs">
            <div className="font-medium">{NETWORK_SPECS[publishRow.network].label} · {publishRow.topic}</div>
            <div className="mt-1 line-clamp-4 whitespace-pre-wrap">{publishRow.copy}</div>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
