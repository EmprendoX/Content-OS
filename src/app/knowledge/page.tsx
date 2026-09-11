import { PageHeader } from "@/components/shared/page-header";
import { BrandFilter } from "@/components/shared/brand-filter";
import { KnowledgeForm } from "@/components/knowledge/knowledge-form";
import { KnowledgeTable } from "@/components/knowledge/knowledge-table";
import { listBrands, listKnowledge } from "@/lib/queries";

export default async function KnowledgePage({ searchParams }: { searchParams: Promise<{ brandId?: string }> }) {
  const { brandId } = await searchParams;
  const brands = listBrands();
  const items = listKnowledge(brandId);
  return (
    <div>
      <PageHeader
        title="Biblioteca de conocimiento"
        description="Documentos, datos y ejemplos que el ResearchAgent usa como única fuente. Lo que no está aquí, no se inventa."
        actions={
          <>
            <BrandFilter brands={brands} />
            <KnowledgeForm brands={brands} defaultBrandId={brandId} />
          </>
        }
      />
      <KnowledgeTable items={items} brands={brands} />
    </div>
  );
}
