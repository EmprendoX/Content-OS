import { PageHeader } from "@/components/shared/page-header";
import { BrandForm } from "@/components/brands/brand-form";

export default function NewBrandPage() {
  return (
    <div>
      <PageHeader title="Nueva marca" description="Define el espacio de la marca. Todo lo que escribas aquí guía a los agentes." />
      <BrandForm />
    </div>
  );
}
