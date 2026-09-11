import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { BrandFilter } from "@/components/shared/brand-filter";
import { EmptyState } from "@/components/shared/empty-state";
import { StateBadge } from "@/components/shared/state-badge";
import { BrandDot, NetworkBadge } from "@/components/shared/network-badge";
import { fmtRelative } from "@/components/shared/format";
import { NewPieceForm } from "@/components/studio/new-piece-form";
import { listBrandNetworks, listBrands, listPieces } from "@/lib/queries";

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ brandId?: string }> }) {
  const { brandId } = await searchParams;
  const brands = listBrands();
  const pieces = listPieces(brandId);
  const networksByBrand = Object.fromEntries(brands.map((b) => [b.id, listBrandNetworks(b.id)]));

  return (
    <div>
      <PageHeader
        title="Estudio de contenido"
        description="Piezas maestras y sus adaptaciones por red. Aquí ves el trabajo de cada agente y editas antes de aprobar."
        actions={
          <>
            <BrandFilter brands={brands} />
            <NewPieceForm brands={brands} networksByBrand={networksByBrand} defaultBrandId={brandId} />
          </>
        }
      />
      {pieces.length === 0 ? (
        <EmptyState title="No hay piezas" description="Crea una pieza o genera contenido desde una idea." />
      ) : (
        <div className="space-y-3">
          {pieces.map((piece) => (
            <Link key={piece.id} href={`/studio/${piece.id}`}>
              <Card className="mb-3 transition-colors hover:bg-muted/40">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <BrandDot color={piece.brand.color} name={piece.brand.name} className="text-xs text-muted-foreground" />
                      <StateBadge state={piece.status} />
                      {piece.campaign && <span className="text-xs text-muted-foreground">· {piece.campaign}</span>}
                    </div>
                    <div className="mt-1 font-medium">{piece.topic}</div>
                    <div className="text-xs text-muted-foreground">Actualizado {fmtRelative(piece.updatedAt)}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {piece.networks.map((n) => <NetworkBadge key={n} network={n} />)}
                    <span className="ml-2 text-xs text-muted-foreground">{piece.variantCount} adaptaciones</span>
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
