"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveKnowledgeAction } from "@/lib/actions/knowledge";
import type { Brand, KnowledgeItem } from "@/lib/db/schema";

const TYPES = [
  { value: "documento", label: "Documento" },
  { value: "enlace", label: "Enlace" },
  { value: "nota", label: "Nota" },
  { value: "dato", label: "Dato autorizado" },
  { value: "ejemplo", label: "Ejemplo aprobado" },
];

export function KnowledgeForm({ brands, defaultBrandId, item, trigger }: { brands: Brand[]; defaultBrandId?: string; item?: KnowledgeItem; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await saveKnowledgeAction(form);
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
            <Plus /> Añadir
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Editar elemento" : "Nuevo elemento de conocimiento"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {item && <input type="hidden" name="id" value={item.id} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Marca</Label>
              <Select name="brandId" defaultValue={item?.brandId ?? defaultBrandId ?? "none"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Compartido (todas)</SelectItem>
                  {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select name="type" defaultValue={item?.type ?? "nota"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="k-title">Título</Label>
            <Input id="k-title" name="title" required defaultValue={item?.title ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="k-content">Contenido</Label>
            <Textarea id="k-content" name="content" rows={6} defaultValue={item?.content ?? ""} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="k-url">URL de origen</Label>
              <Input id="k-url" name="sourceUrl" type="url" defaultValue={item?.sourceUrl ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="k-tags">Etiquetas (coma)</Label>
              <Input id="k-tags" name="tags" defaultValue={item?.tags.join(", ") ?? ""} />
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
