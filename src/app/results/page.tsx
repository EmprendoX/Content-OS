import { PageHeader } from "@/components/shared/page-header";
import { BrandFilter } from "@/components/shared/brand-filter";
import { ResultsPanel } from "@/components/results/results-panel";
import { listBrands, listResults } from "@/lib/queries";

export default async function ResultsPage({ searchParams }: { searchParams: Promise<{ brandId?: string }> }) {
  const { brandId } = await searchParams;
  const brands = listBrands();
  const rows = listResults(brandId);
  return (
    <div>
      <PageHeader
        title="Resultados"
        description="Métricas de contenido publicado (simuladas en esta fase) y análisis del AnalyticsAgent."
        actions={<BrandFilter brands={brands} />}
      />
      <ResultsPanel rows={rows} brands={brands} brandId={brandId} />
    </div>
  );
}
