import { PageHeader } from "@/components/shared/page-header";
import { ConnectionsPanel } from "@/components/connections/connections-panel";
import { listBrands, listConnections, listRecentJobs } from "@/lib/queries";

export default function ConnectionsPage() {
  const brands = listBrands();
  const connections = listConnections();
  const jobs = listRecentJobs(30);
  return (
    <div>
      <PageHeader
        title="Conexiones sociales"
        description="Fase 1: todos los conectores son simulados. Los tokens se cifran localmente y nunca llegan a los agentes ni a los prompts."
      />
      <ConnectionsPanel brands={brands} connections={connections} jobs={jobs} />
    </div>
  );
}
