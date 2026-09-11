import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { NetworkBadge } from "@/components/shared/network-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { getBrand, listBrands } from "@/lib/queries";

export default function BrandsPage() {
  const brands = listBrands().map((b) => getBrand(b.id)!);
  return (
    <div>
      <PageHeader
        title="Marcas"
        description="Cada marca es un espacio separado con su voz, productos, audiencias y reglas."
        actions={
          <Button asChild>
            <Link href="/brands/new">
              <Plus /> Nueva marca
            </Link>
          </Button>
        }
      />
      {brands.length === 0 ? (
        <EmptyState title="Aún no hay marcas" description="Crea la primera para empezar a generar contenido." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {brands.map((brand) => (
            <Link key={brand.id} href={`/brands/${brand.id}`}>
              <Card className="h-full transition-colors hover:bg-muted/40">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <span className="inline-block size-3 rounded-full" style={{ backgroundColor: brand.color }} />
                    <h2 className="font-semibold">{brand.name}</h2>
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{brand.description || "Sin descripción."}</p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {brand.networks.filter((n) => n.enabled).map((n) => (
                      <NetworkBadge key={n.id} network={n.network} />
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
                    <div><div className="text-base font-semibold text-foreground">{brand.products.length}</div>productos</div>
                    <div><div className="text-base font-semibold text-foreground">{brand.audiences.length}</div>audiencias</div>
                    <div><div className="text-base font-semibold text-foreground">{brand.forbiddenWords.length}</div>prohibidas</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
