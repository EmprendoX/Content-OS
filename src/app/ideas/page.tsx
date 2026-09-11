import { PageHeader } from "@/components/shared/page-header";
import { BrandFilter } from "@/components/shared/brand-filter";
import { EmptyState } from "@/components/shared/empty-state";
import { IdeaForm } from "@/components/ideas/idea-form";
import { IdeaCard } from "@/components/ideas/idea-card";
import { listBrandNetworks, listBrands, listIdeas } from "@/lib/queries";

export default async function IdeasPage({ searchParams }: { searchParams: Promise<{ brandId?: string }> }) {
  const { brandId } = await searchParams;
  const brands = listBrands();
  const ideas = listIdeas(brandId);
  const networksByBrand = Object.fromEntries(brands.map((b) => [b.id, listBrandNetworks(b.id)]));
  const open = ideas.filter((i) => i.status === "abierta" || i.status === "en_proceso");
  const done = ideas.filter((i) => i.status === "convertida" || i.status === "archivada");

  return (
    <div>
      <PageHeader
        title="Ideas"
        description="Cada idea puede convertirse en una pieza maestra y sus adaptaciones con un clic. El resultado siempre queda pendiente de tu aprobación."
        actions={
          <>
            <BrandFilter brands={brands} />
            <IdeaForm brands={brands} defaultBrandId={brandId} />
          </>
        }
      />
      {ideas.length === 0 ? (
        <EmptyState title="Sin ideas todavía" description="Añade la primera o deja que el AnalyticsAgent sugiera algunas desde Resultados." />
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Abiertas ({open.length})</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {open.map((idea) => (
                <IdeaCard key={idea.id} idea={idea} brand={brands.find((b) => b.id === idea.brandId)!} networks={networksByBrand[idea.brandId] ?? []} />
              ))}
            </div>
          </section>
          {done.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">Convertidas o archivadas ({done.length})</h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {done.map((idea) => (
                  <IdeaCard key={idea.id} idea={idea} brand={brands.find((b) => b.id === idea.brandId)!} networks={networksByBrand[idea.brandId] ?? []} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
