"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface BrandOption {
  id: string;
  name: string;
  color: string;
}

/** Filtro por marca que se refleja en ?brandId= de la URL. */
export function BrandFilter({ brands, param = "brandId" }: { brands: BrandOption[]; param?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const value = params.get(param) ?? "all";

  function onChange(next: string) {
    const search = new URLSearchParams(params.toString());
    if (next === "all") search.delete(param);
    else search.set(param, next);
    router.push(`${pathname}?${search.toString()}`);
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-52" aria-label="Filtrar por marca">
        <SelectValue placeholder="Todas las marcas" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todas las marcas</SelectItem>
        {brands.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            <span className="inline-flex items-center gap-2">
              <span className="inline-block size-2 rounded-full" style={{ backgroundColor: b.color }} />
              {b.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
