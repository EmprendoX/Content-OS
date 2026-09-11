import { notFound } from "next/navigation";
import { PieceDetail } from "@/components/studio/piece-detail";
import { getPieceDetail } from "@/lib/queries";
import { isPublishingEnabled, isGlobalDryRun } from "@/lib/settings";
import { getDb } from "@/lib/db/client";

export default async function PiecePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = getPieceDetail(id);
  if (!detail) notFound();
  const db = getDb();
  return (
    <PieceDetail
      {...detail}
      publishingEnabled={isPublishingEnabled(db)}
      globalDryRun={isGlobalDryRun(db)}
    />
  );
}
