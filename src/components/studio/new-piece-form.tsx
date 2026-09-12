"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createPieceAction } from "@/lib/actions/studio";
import { NETWORK_SPECS, NETWORKS, type Network } from "@/lib/networks";
import type { Brand } from "@/lib/db/schema";

export function NewPieceForm({ brands, networksByBrand, defaultBrandId }: { brands: Brand[]; networksByBrand: Record<string, Network[]>; defaultBrandId?: string }) {
  const [open, setOpen] = useState(false);
  const [brandId, setBrandId] = useState(defaultBrandId ?? brands[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const suggested = networksByBrand[brandId] ?? [];

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createPieceAction(form);
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        router.push(`/studio/${result.data!.pieceId}`);
      } else toast.error(result.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus /> Nueva pieza</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nueva pieza de contenido</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Marca</Label>
            <Select name="brandId" value={brandId} onValueChange={setBrandId}>
              <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>{brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-topic">Tema</Label>
            <Input id="p-topic" name="topic" required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="p-campaign">Campaña</Label>
              <Input id="p-campaign" name="campaign" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-goal">Objetivo</Label>
              <Input id="p-goal" name="goal" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Redes</Label>
            <div className="grid grid-cols-2 gap-2">
              {NETWORKS.map((n) => (
                <label key={n} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <Checkbox name="networks" value={n} defaultChecked={suggested.includes(n)} />
                  {NETWORK_SPECS[n].label}
                </label>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="run" defaultChecked /> Ejecutar el pipeline de agentes ahora
          </label>
          <p className="text-xs text-muted-foreground">Con un proveedor real el pipeline tarda entre 2 y 5 minutos. No cierres la pestaña.</p>
          <DialogFooter>
            <Button type="submit" disabled={pending}>{pending ? "Creando…" : "Crear"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
