"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveIdeaAction } from "@/lib/actions/ideas";
import type { Brand, Idea } from "@/lib/db/schema";

export function IdeaForm({ brands, defaultBrandId, idea, trigger }: { brands: Brand[]; defaultBrandId?: string; idea?: Idea; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await saveIdeaAction(form);
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        router.refresh();
      } else toast.error(result.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus /> Nueva idea
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{idea ? "Editar idea" : "Nueva idea"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {idea && <input type="hidden" name="id" value={idea.id} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Marca</Label>
              <Select name="brandId" defaultValue={idea?.brandId ?? defaultBrandId ?? brands[0]?.id}>
                <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>
                  {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridad</Label>
              <Select name="priority" defaultValue={String(idea?.priority ?? 2)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Alta</SelectItem>
                  <SelectItem value="2">Media</SelectItem>
                  <SelectItem value="3">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="i-title">Título / tema</Label>
            <Input id="i-title" name="title" required defaultValue={idea?.title ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="i-desc">Descripción</Label>
            <Textarea id="i-desc" name="description" rows={3} defaultValue={idea?.description ?? ""} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="i-campaign">Campaña</Label>
              <Input id="i-campaign" name="campaign" defaultValue={idea?.campaign ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="i-goal">Objetivo</Label>
              <Input id="i-goal" name="goal" defaultValue={idea?.goal ?? ""} placeholder="Ej. solicitudes de auditoría" />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
