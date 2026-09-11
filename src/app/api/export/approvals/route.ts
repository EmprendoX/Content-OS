import { NextResponse, type NextRequest } from "next/server";
import { listApprovalRows } from "@/lib/queries";
import { isNetwork } from "@/lib/networks";
import { isContentState, STATE_LABELS } from "@/lib/workflow/states";
import { NETWORK_SPECS } from "@/lib/networks";

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

/** Exporta la hoja de aprobación (con los filtros activos) en CSV. */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const brandId = params.get("brandId") || undefined;
  const status = params.get("status");
  const network = params.get("network");
  const ids = params.get("ids")?.split(",").filter(Boolean);

  let rows = listApprovalRows({
    brandId,
    status: status && isContentState(status) ? status : undefined,
    network: network && isNetwork(network) ? network : undefined,
  });
  if (ids && ids.length > 0) rows = rows.filter((r) => ids.includes(r.id));

  const header = [
    "Fecha",
    "Marca",
    "Campaña",
    "Tema",
    "Red",
    "Formato",
    "Hook",
    "Copy",
    "CTA",
    "Hashtags",
    "Archivo visual",
    "Comentarios del revisor",
    "Estado",
    "Fecha programada",
    "Enlace publicado",
    "Impresiones",
    "Me gusta",
    "Comentarios",
    "Compartidos",
    "Clics",
  ];
  const lines = rows.map((r) =>
    [
      r.date,
      r.brandName,
      r.campaign,
      r.topic,
      NETWORK_SPECS[r.network].label,
      r.format,
      r.hook,
      r.copy,
      r.cta,
      r.hashtags.join(" "),
      r.visualAssetName ?? "",
      r.reviewerComments,
      STATE_LABELS[r.status],
      r.scheduledAt ?? "",
      r.publishedUrl ?? "",
      r.metrics?.impressions ?? "",
      r.metrics?.likes ?? "",
      r.metrics?.comments ?? "",
      r.metrics?.shares ?? "",
      r.metrics?.clicks ?? "",
    ]
      .map(csvCell)
      .join(","),
  );
  const csv = "﻿" + [header.map(csvCell).join(","), ...lines].join("\r\n");
  const filename = `hoja-aprobacion-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
