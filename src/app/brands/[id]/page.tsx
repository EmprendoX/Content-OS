import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { BrandForm } from "@/components/brands/brand-form";
import { getBrand } from "@/lib/queries";

export default async function BrandDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const brand = getBrand(id);
  if (!brand) notFound();
  return (
    <div>
      <PageHeader title={brand.name} description="Edita el contexto que reciben los agentes para esta marca." />
      <BrandForm brand={brand} />
    </div>
  );
}
