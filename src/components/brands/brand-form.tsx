"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveBrandAction } from "@/lib/actions/brands";
import { LOCALES, LOCALE_LABELS } from "@/lib/locales";
import { NETWORK_SPECS, NETWORKS } from "@/lib/networks";
import type { Brand, BrandNetwork } from "@/lib/db/schema";

type BrandWithNetworks = Brand & { networks: BrandNetwork[] };

function ListField({ name, label, hint, value }: { name: string; label: string; hint?: string; value?: string[] }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Textarea id={name} name={name} rows={4} defaultValue={value?.join("\n") ?? ""} placeholder="Una por línea" />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function BrandForm({ brand }: { brand?: BrandWithNetworks }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await saveBrandAction(form);
      if (result.ok) {
        toast.success(result.message);
        router.push(`/brands/${result.data!.id}`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {brand && <input type="hidden" name="id" value={brand.id} />}

      <Card>
        <CardHeader><CardTitle className="text-base">Identidad</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[1fr_120px]">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" required defaultValue={brand?.name ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="color">Color</Label>
            <Input id="color" name="color" type="color" defaultValue={brand?.color ?? "#2563eb"} className="h-8 p-1" />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" name="description" rows={3} defaultValue={brand?.description ?? ""} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="voiceTone">Voz y tono</Label>
            <Textarea id="voiceTone" name="voiceTone" rows={3} defaultValue={brand?.voiceTone ?? ""} placeholder="Cómo habla la marca: registro, tuteo, ritmo, lo que evita…" />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Región del español</Label>
            <Select name="locale" defaultValue={brand?.locale ?? "es-MX"}>
              <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LOCALES.map((l) => <SelectItem key={l} value={l}>{LOCALE_LABELS[l]}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Define el vocabulario y el registro que usan los agentes (por ejemplo, celular y negocio en México frente a móvil y pyme en España).</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Oferta y audiencia</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <ListField name="products" label="Productos" value={brand?.products} />
          <ListField name="audiences" label="Audiencias" value={brand?.audiences} />
          <ListField name="offers" label="Ofertas" value={brand?.offers} />
          <ListField name="ctas" label="Llamados a la acción" value={brand?.ctas} />
          <ListField name="proofPoints" label="Pruebas y datos autorizados" hint="Los agentes solo pueden usar cifras que aparezcan aquí." value={brand?.proofPoints} />
          <div className="space-y-1.5">
            <Label htmlFor="approvedExamples">Textos reales de la marca (referencia de voz)</Label>
            <Textarea
              id="approvedExamples"
              name="approvedExamples"
              rows={10}
              defaultValue={brand?.approvedExamples.join("\n---\n") ?? ""}
              placeholder={"Pega aquí 3 a 5 publicaciones tuyas que suenen como quieres sonar. Separa cada una con una línea que solo diga ---"}
            />
            <p className="text-xs text-muted-foreground">Es lo que más influye en que el contenido suene a ti. Cuantos más textos reales y completos, mejor. Separa cada texto con una línea que solo contenga tres guiones (---).</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Reglas de lenguaje</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <ListField name="preferredWords" label="Palabras preferidas" value={brand?.preferredWords} />
          <ListField name="forbiddenWords" label="Palabras prohibidas" hint="El revisor bloquea cualquier texto que las contenga." value={brand?.forbiddenWords} />
          <ListField name="forbiddenPromises" label="Promesas que no deben hacerse" value={brand?.forbiddenPromises} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Redes sociales asociadas</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {NETWORKS.map((network) => {
            const row = brand?.networks.find((n) => n.network === network);
            return (
              <div key={network} className="flex items-center gap-3 rounded-md border border-border p-3">
                <Checkbox id={`network_${network}`} name={`network_${network}`} defaultChecked={row?.enabled ?? false} />
                <Label htmlFor={`network_${network}`} className="w-24">{NETWORK_SPECS[network].label}</Label>
                <Input name={`handle_${network}`} placeholder="@usuario" defaultValue={row?.handle ?? ""} className="flex-1" />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push("/brands")} disabled={pending}>Cancelar</Button>
        <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar marca"}</Button>
      </div>
    </form>
  );
}
