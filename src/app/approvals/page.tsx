import { PageHeader } from "@/components/shared/page-header";
import { ApprovalSheet } from "@/components/approvals/approval-sheet";
import { listApprovalRows, listBrands } from "@/lib/queries";
import { isNetwork } from "@/lib/networks";
import { isContentState } from "@/lib/workflow/states";
import { getDb } from "@/lib/db/client";
import { isGlobalDryRun, isPublishingEnabled } from "@/lib/settings";

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<{ brandId?: string; status?: string; network?: string }> }) {
  const { brandId, status, network } = await searchParams;
  const brands = listBrands();
  const rows = listApprovalRows({
    brandId: brandId || undefined,
    status: status && isContentState(status) ? status : undefined,
    network: network && isNetwork(network) ? network : undefined,
  });
  const db = getDb();
  return (
    <div>
      <PageHeader
        title="Hoja de aprobación"
        description="Una fila por adaptación. Edita celdas directamente, selecciona varias y aprueba en lote. Solo tú puedes aprobar."
      />
      <ApprovalSheet
        rows={rows}
        brands={brands}
        filters={{ brandId: brandId ?? "", status: status ?? "", network: network ?? "" }}
        publishingEnabled={isPublishingEnabled(db)}
        globalDryRun={isGlobalDryRun(db)}
      />
    </div>
  );
}
