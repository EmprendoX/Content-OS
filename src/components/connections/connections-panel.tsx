"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BrandDot, NetworkBadge } from "@/components/shared/network-badge";
import { fmtDateTime } from "@/components/shared/format";
import { removeTokenAction, saveConnectionAction, toggleConnectionDryRunAction } from "@/lib/actions/connections";
import { NETWORK_SPECS, NETWORKS } from "@/lib/networks";
import type { Brand } from "@/lib/db/schema";
import type { listConnections, listRecentJobs } from "@/lib/queries";

type Connection = ReturnType<typeof listConnections>[number];
type Job = ReturnType<typeof listRecentJobs>[number];

export function ConnectionsPanel({ brands, connections, jobs }: { brands: Brand[]; connections: Connection[]; jobs: Job[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

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

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(saveConnectionAction(new FormData(event.currentTarget)), () => setOpen(false));
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus /> Conexión</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nueva conexión (simulada)</DialogTitle></DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Marca</Label>
                  <Select name="brandId" defaultValue={brands[0]?.id}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Red</Label>
                  <Select name="network" defaultValue="linkedin">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{NETWORKS.map((n) => <SelectItem key={n} value={n}>{NETWORK_SPECS[n].label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-label">Etiqueta</Label>
                <Input id="c-label" name="label" placeholder="@cuenta" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-token">Token de acceso (opcional)</Label>
                <Input id="c-token" name="token" type="password" autoComplete="off" placeholder="Se cifra con AES-256-GCM antes de guardarse" />
                <p className="text-xs text-muted-foreground">En esta fase el token no se usa contra ninguna API real; solo se guarda cifrado.</p>
              </div>
              <input type="hidden" name="dryRun" value="on" />
              <DialogFooter><Button type="submit" disabled={pending}>Guardar</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Marca</TableHead>
              <TableHead>Red</TableHead>
              <TableHead>Etiqueta</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Token</TableHead>
              <TableHead>Dry Run</TableHead>
              <TableHead>Actualizada</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {connections.length === 0 && <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Sin conexiones.</TableCell></TableRow>}
            {connections.map((c) => (
              <TableRow key={c.id}>
                <TableCell><BrandDot color={c.brandColor} name={c.brandName} /></TableCell>
                <TableCell><NetworkBadge network={c.network} /></TableCell>
                <TableCell>{c.label}</TableCell>
                <TableCell><Badge variant="secondary">{c.status}</Badge></TableCell>
                <TableCell>
                  {c.hasToken ? <span className="inline-flex items-center gap-1 text-xs"><KeyRound className="size-3" /> cifrado</span> : <span className="text-xs text-muted-foreground">sin token</span>}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch checked={c.dryRun} onCheckedChange={(v) => run(toggleConnectionDryRunAction(c.id, v))} disabled={pending} aria-label="Dry Run" />
                    <span className="text-xs text-muted-foreground">{c.dryRun ? "activo" : "desactivado"}</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{fmtDateTime(c.updatedAt)}</TableCell>
                <TableCell>
                  {c.hasToken && (
                    <Button size="icon-sm" variant="ghost" aria-label="Eliminar token" onClick={() => { if (window.confirm("¿Eliminar el token cifrado?")) run(removeTokenAction(c.id)); }} disabled={pending}><Trash2 /></Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Registro de publicaciones (payload, respuesta, errores, intentos)</CardTitle></CardHeader>
        <CardContent>
          {jobs.length === 0 ? <p className="text-sm text-muted-foreground">Sin intentos todavía.</p> : (
            <div className="space-y-2">
              {jobs.map((j) => (
                <details key={j.id} className="rounded-md border border-border px-3 py-2 text-sm">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                    <Badge variant={j.status === "exito" ? "secondary" : j.status === "fallido" ? "destructive" : "outline"}>{j.status}</Badge>
                    <NetworkBadge network={j.network} />
                    <Link href={`/studio/${j.pieceId}`} className="font-medium hover:underline">{j.topic}</Link>
                    <span className="text-xs text-muted-foreground">{j.brandName} · {j.dryRun ? "dry run" : "simulado real"} · intento {j.attempts} · {fmtDateTime(j.executedAt ?? j.createdAt)}</span>
                    {j.error && <span className="w-full text-xs text-red-700">{j.error}</span>}
                  </summary>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <div>
                      <div className="mb-1 text-xs font-medium">Payload</div>
                      <pre className="max-h-48 overflow-auto rounded bg-muted/50 p-2 text-[11px]">{JSON.stringify(j.payload, null, 2)}</pre>
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-medium">Respuesta</div>
                      <pre className="max-h-48 overflow-auto rounded bg-muted/50 p-2 text-[11px]">{JSON.stringify(j.response, null, 2)}</pre>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
