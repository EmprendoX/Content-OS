"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Pencil, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { BrandDot } from "@/components/shared/network-badge";
import { generateFromIdeaAction, setIdeaStatusAction } from "@/lib/actions/ideas";
import { NETWORK_SPECS, NETWORKS, type Network } from "@/lib/networks";
import type { Brand, Idea } from "@/lib/db/schema";
import { IdeaForm } from "./idea-form";

const PRIORITY = { 1: "Alta", 2: "Media", 3: "Baja" } as Record<number, string>;

export function IdeaCard({ idea, brand, networks }: { idea: Idea; brand: Brand; networks: Network[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Network[]>(networks.length ? networks : ["linkedin"]);

  function generate() {
    startTransition(async () => {
      const result = await generateFromIdeaAction(idea.id, selected);
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        router.push(`/studio/${result.data!.pieceId}`);
      } else toast.error(result.error);
    });
  }

  function archive() {
    startTransition(async () => {
      const result = await setIdeaStatusAction(idea.id, idea.status === "archivada" ? "abierta" : "archivada");
      if (result.ok) router.refresh();
      else toast.error(result.error);
    });
  }

  return (
    <Card className="flex h-full flex-col">
      <CardContent className="flex flex-1 flex-col pt-6">
        <div className="flex items-center justify-between gap-2">
          <BrandDot color={brand.color} name={brand.name} className="text-xs text-muted-foreground" />
          <div className="flex items-center gap-1">
            <Badge variant="outline">{PRIORITY[idea.priority] ?? "Media"}</Badge>
            <Badge variant="secondary">{idea.status.replace("_", " ")}</Badge>
          </div>
        </div>
        <h3 className="mt-2 font-medium">{idea.title}</h3>
        <p className="mt-1 flex-1 text-sm text-muted-foreground">{idea.description || "Sin descripción."}</p>
        {(idea.campaign || idea.goal) && (
          <div className="mt-2 text-xs text-muted-foreground">
            {idea.campaign && <span>Campaña: {idea.campaign}</span>}
            {idea.campaign && idea.goal && " · "}
            {idea.goal && <span>Objetivo: {idea.goal}</span>}
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {idea.pieceId ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/studio/${idea.pieceId}`}>Ver en Estudio</Link>
            </Button>
          ) : (
            <Button size="sm" onClick={() => setOpen(true)} disabled={pending || idea.status === "archivada"}>
              <Sparkles /> Generar contenido
            </Button>
          )}
          <IdeaForm brands={[brand]} idea={idea} trigger={<Button size="icon-sm" variant="ghost" aria-label="Editar"><Pencil /></Button>} />
          <Button size="icon-sm" variant="ghost" aria-label="Archivar" onClick={archive} disabled={pending}><Archive /></Button>
        </div>
      </CardContent>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Generar contenido con agentes"
        description="Se ejecutará el pipeline completo (investigación, estrategia, pieza maestra, adaptaciones, brief visual, revisión y editor jefe). El resultado quedará pendiente de tu aprobación."
        confirmLabel="Generar"
        pending={pending}
        onConfirm={generate}
      >
        <div className="space-y-2">
          <Label>Redes a adaptar</Label>
          <div className="grid grid-cols-2 gap-2">
            {NETWORKS.map((n) => (
              <label key={n} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <Checkbox
                  checked={selected.includes(n)}
                  onCheckedChange={(checked) => setSelected((prev) => (checked ? [...prev, n] : prev.filter((x) => x !== n)))}
                />
                {NETWORK_SPECS[n].label}
                {!networks.includes(n) && <span className="text-xs text-muted-foreground">(no asociada)</span>}
              </label>
            ))}
          </div>
        </div>
      </ConfirmDialog>
    </Card>
  );
}
