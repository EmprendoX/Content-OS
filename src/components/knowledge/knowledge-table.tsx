"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { fmtDate, truncate } from "@/components/shared/format";
import { deleteKnowledgeAction } from "@/lib/actions/knowledge";
import type { Brand, KnowledgeItem } from "@/lib/db/schema";
import { KnowledgeForm } from "./knowledge-form";

export function KnowledgeTable({ items, brands }: { items: KnowledgeItem[]; brands: Brand[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const brandName = (id: string | null) => brands.find((b) => b.id === id)?.name ?? "Compartido";

  function remove(id: string) {
    if (!window.confirm("¿Eliminar este elemento de la biblioteca?")) return;
    startTransition(async () => {
      const result = await deleteKnowledgeAction(id);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else toast.error(result.error);
    });
  }

  if (items.length === 0) {
    return <EmptyState title="La biblioteca está vacía" description="Añade documentos, datos autorizados o ejemplos aprobados." />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Título</TableHead>
            <TableHead>Marca</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Contenido</TableHead>
            <TableHead>Etiquetas</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.title}</TableCell>
              <TableCell className="text-muted-foreground">{brandName(item.brandId)}</TableCell>
              <TableCell><Badge variant="secondary">{item.type}</Badge></TableCell>
              <TableCell className="max-w-md text-muted-foreground">{truncate(item.content, 120)}</TableCell>
              <TableCell className="space-x-1">{item.tags.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDate(item.createdAt)}</TableCell>
              <TableCell className="whitespace-nowrap">
                <KnowledgeForm brands={brands} item={item} trigger={<Button size="icon-sm" variant="ghost" aria-label="Editar"><Pencil /></Button>} />
                <Button size="icon-sm" variant="ghost" aria-label="Eliminar" onClick={() => remove(item.id)} disabled={pending}><Trash2 /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
