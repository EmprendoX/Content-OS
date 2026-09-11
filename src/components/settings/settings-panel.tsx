"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Database, KeyRound, RotateCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { fmtDateTime } from "@/components/shared/format";
import { resetDemoAction, setGlobalDryRunAction, setLlmProviderAction, setPublishingEnabledAction } from "@/lib/actions/settings";
import { AGENT_CATALOG } from "@/lib/agents/agents";
import { LLM_PROVIDER_OPTIONS } from "@/lib/llm";
import type { LlmProviderName } from "@/lib/settings";
import type { AuditEntry } from "@/lib/db/schema";

interface Props {
  publishingEnabled: boolean;
  globalDryRun: boolean;
  provider: LlmProviderName;
  model: string;
  env: { anthropic: boolean; openai: boolean; ollamaUrl: string; keySource: "env" | "file"; dbPath: string };
  audit: AuditEntry[];
}

export function SettingsPanel({ publishingEnabled, globalDryRun, provider, model, env, audit }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedProvider, setSelectedProvider] = useState<LlmProviderName>(provider);
  const [modelName, setModelName] = useState(model);
  const [resetOpen, setResetOpen] = useState(false);
  const [enableOpen, setEnableOpen] = useState(false);

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

  const providerReady =
    selectedProvider === "mock" || (selectedProvider === "anthropic" && env.anthropic) || (selectedProvider === "openai" && env.openai) || selectedProvider === "ollama";

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className={publishingEnabled ? "border-emerald-300" : "border-red-300"}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4" /> Interruptor global de publicaciones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <div className="text-sm font-medium">Publicaciones {publishingEnabled ? "activadas" : "desactivadas"}</div>
                <p className="text-xs text-muted-foreground">Cuando está desactivado, el PublisherAgent rechaza cualquier intento, incluidas las programadas.</p>
              </div>
              <Switch
                checked={publishingEnabled}
                onCheckedChange={(v) => (v ? setEnableOpen(true) : run(setPublishingEnabledAction(false)))}
                disabled={pending}
                aria-label="Interruptor global"
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <div className="text-sm font-medium">Dry Run global</div>
                <p className="text-xs text-muted-foreground">Valida y registra el payload sin enviar nada, aunque una conexión tenga Dry Run desactivado.</p>
              </div>
              <Switch checked={globalDryRun} onCheckedChange={(v) => run(setGlobalDryRunAction(v))} disabled={pending} aria-label="Dry Run global" />
            </div>
            {publishingEnabled && !globalDryRun && (
              <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                Publicación activa sin Dry Run: los conectores (simulados en esta fase) recibirán los envíos.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Proveedor de IA</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Proveedor</Label>
              <Select value={selectedProvider} onValueChange={(v) => setSelectedProvider(v as LlmProviderName)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LLM_PROVIDER_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{LLM_PROVIDER_OPTIONS.find((o) => o.value === selectedProvider)?.hint}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="model">Modelo (opcional)</Label>
              <Input id="model" value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="Vacío = valor del entorno" disabled={selectedProvider === "mock"} />
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant={env.anthropic ? "secondary" : "outline"}>ANTHROPIC_API_KEY {env.anthropic ? "presente" : "ausente"}</Badge>
              <Badge variant={env.openai ? "secondary" : "outline"}>OPENAI_API_KEY {env.openai ? "presente" : "ausente"}</Badge>
              <Badge variant="outline">Ollama: {env.ollamaUrl}</Badge>
            </div>
            {!providerReady && <p className="text-xs text-red-700">Falta la clave en el entorno para este proveedor. Añádela a .env.local y reinicia.</p>}
            <Button size="sm" onClick={() => run(setLlmProviderAction(selectedProvider, modelName))} disabled={pending || !providerReady}>Guardar proveedor</Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><KeyRound className="size-4" /> Seguridad y datos</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between"><span>Clave de cifrado de tokens</span><Badge variant="secondary">{env.keySource === "env" ? "variable de entorno" : "archivo local data/.encryption-key"}</Badge></div>
            <div className="flex items-center justify-between"><span>Base de datos</span><span className="font-mono text-xs text-muted-foreground">{env.dbPath}</span></div>
            <div className="flex items-center justify-between"><span>Acceso</span><Badge variant="secondary">solo localhost</Badge></div>
            <div className="flex items-center justify-between"><span>Versiones de contenido</span><Badge variant="secondary">nunca se borran</Badge></div>
            <div className="border-t border-border pt-3">
              <Button variant="destructive" size="sm" onClick={() => setResetOpen(true)} disabled={pending}><RotateCcw /> Regenerar datos de demostración</Button>
              <p className="mt-1 text-xs text-muted-foreground">Borra la base de datos local y la vuelve a crear con la demo. No toca los archivos multimedia.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Agentes del flujo</CardTitle></CardHeader>
          <CardContent>
            <ol className="space-y-1 text-sm">
              {AGENT_CATALOG.map((a, i) => (
                <li key={a.name} className="flex gap-2"><span className="w-5 text-right text-muted-foreground">{i + 1}.</span><span className="font-medium">{a.name}</span><span className="text-muted-foreground">— {a.role}</span></li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Database className="size-4" /> Registro de auditoría</CardTitle></CardHeader>
        <CardContent>
          <div className="max-h-[480px] overflow-auto rounded-md border border-border">
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Entidad</TableHead>
                  <TableHead>Detalles</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audit.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDateTime(a.createdAt)}</TableCell>
                    <TableCell>{a.actor}</TableCell>
                    <TableCell><Badge variant="outline">{a.action}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{a.entityType} · {a.entityId.slice(0, 8)}</TableCell>
                    <TableCell className="max-w-md truncate font-mono text-[11px] text-muted-foreground">{a.details ? JSON.stringify(a.details) : ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={enableOpen}
        onOpenChange={setEnableOpen}
        title="Activar publicaciones"
        description="A partir de ahora el PublisherAgent podrá enviar contenido APPROVED o SCHEDULED a los conectores. Cada envío sigue exigiendo confirmación individual."
        confirmLabel="Activar"
        pending={pending}
        onConfirm={() => run(setPublishingEnabledAction(true), () => setEnableOpen(false))}
      />
      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Regenerar datos de demostración"
        description="Se borrará la base de datos local (marcas, piezas, auditoría) y se creará la demo de nuevo. Esta acción no se puede deshacer."
        confirmLabel="Regenerar"
        destructive
        pending={pending}
        onConfirm={() => run(resetDemoAction(), () => setResetOpen(false))}
      />
    </div>
  );
}
