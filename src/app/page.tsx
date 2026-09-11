import Link from "next/link";
import { addDays, format, isSameDay, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, ClipboardCheck, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { StateBadge } from "@/components/shared/state-badge";
import { BrandDot, NetworkBadge } from "@/components/shared/network-badge";
import { fmtNumber, truncate } from "@/components/shared/format";
import { currentWeekStart, dashboardData } from "@/lib/queries";
import { STATE_GROUPS, STATE_LABELS } from "@/lib/workflow/states";

export default function DashboardPage() {
  const data = dashboardData();
  const weekStart = currentWeekStart();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const stats = [
    { label: "Pendiente de revisar", value: data.totals.pendingReview, icon: ClipboardCheck, href: "/approvals?status=READY_FOR_APPROVAL", tone: "text-orange-600" },
    { label: "Programado", value: data.totals.scheduled, icon: CalendarDays, href: "/calendar", tone: "text-teal-600" },
    { label: "Publicado", value: data.totals.published, icon: CheckCircle2, href: "/results", tone: "text-green-600" },
    { label: "Fallidos", value: data.totals.failed, icon: AlertTriangle, href: "/approvals?status=FAILED", tone: "text-red-600" },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Estado del flujo editorial. Nada se publica sin tu aprobación."
        actions={
          <Button asChild>
            <Link href="/approvals">
              Ir a la hoja de aprobación <ArrowRight />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="transition-colors hover:bg-muted/40">
              <CardContent className="flex items-center justify-between pt-6">
                <div>
                  <div className="text-sm text-muted-foreground">{s.label}</div>
                  <div className="mt-1 text-3xl font-semibold tabular-nums">{s.value}</div>
                </div>
                <s.icon className={`size-6 ${s.tone}`} />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {data.failed.length > 0 && (
        <Card className="mt-6 border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-red-700 dark:text-red-300">
              <AlertTriangle className="size-4" /> Publicaciones fallidas ({data.failed.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.failed.map((f) => (
              <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-background px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <NetworkBadge network={f.network} />
                  <span className="font-medium">{f.topic}</span>
                  <span className="text-muted-foreground">· {f.brandName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-red-700 dark:text-red-300">{truncate(f.error, 90)}</span>
                  <Button asChild size="xs" variant="outline">
                    <Link href={`/studio/${f.pieceId}`}>Revisar</Link>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Pendiente de revisar</CardTitle>
            <Button asChild size="sm" variant="ghost">
              <Link href="/approvals">Ver todo</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.pending.length === 0 && <p className="text-sm text-muted-foreground">No hay contenido pendiente. Genera uno desde Ideas.</p>}
            {data.pending.map((p) => (
              <Link
                key={p.id}
                href={`/studio/${p.pieceId}`}
                className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2.5 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <BrandDot color={p.brandColor} name={p.brandName} className="text-xs text-muted-foreground" />
                    <NetworkBadge network={p.network} />
                    <StateBadge state={p.status} />
                  </div>
                  <div className="mt-1 truncate text-sm font-medium">{p.topic}</div>
                  <div className="truncate text-xs text-muted-foreground">{p.hook}</div>
                </div>
                {p.reviewScore !== null && (
                  <div className="shrink-0 text-right">
                    <div className="text-xs text-muted-foreground">Revisión</div>
                    <div className="text-sm font-semibold tabular-nums">{p.reviewScore}/100</div>
                  </div>
                )}
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Estado del flujo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {STATE_GROUPS.map((group) => {
              const total = group.states.reduce((acc, s) => acc + data.counts[s], 0);
              return (
                <div key={group.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium">{group.label}</span>
                    <span className="tabular-nums text-muted-foreground">{total}</span>
                  </div>
                  <div className="space-y-1">
                    {group.states.map((s) => (
                      <div key={s} className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{STATE_LABELS[s]}</span>
                        <span className="tabular-nums">{data.counts[s]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Esta semana</CardTitle>
            <Button asChild size="sm" variant="ghost">
              <Link href="/calendar">Calendario completo</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {days.map((day) => {
                const items = data.week.filter((w) => isSameDay(parseISO(w.at), day));
                const today = isSameDay(day, new Date());
                return (
                  <div key={day.toISOString()} className={`min-h-28 rounded-md border p-2 ${today ? "border-primary/50 bg-primary/5" : "border-border"}`}>
                    <div className="mb-1 text-[11px] font-medium uppercase text-muted-foreground">
                      {format(day, "EEE d", { locale: es })}
                    </div>
                    <div className="space-y-1">
                      {items.map((it) => (
                        <Link key={it.id} href={`/studio/${it.pieceId}`} className="block rounded bg-muted px-1.5 py-1 text-[11px] leading-tight hover:bg-muted/70">
                          <span className="mr-1 inline-block size-1.5 rounded-full align-middle" style={{ backgroundColor: it.brandColor }} />
                          {format(parseISO(it.at), "HH:mm")} · {it.network}
                          <div className="truncate text-muted-foreground">{it.topic}</div>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Resultados recientes</CardTitle>
            <Button asChild size="sm" variant="ghost">
              <Link href="/results">Ver</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.results.length === 0 && <p className="text-sm text-muted-foreground">Sin publicaciones todavía.</p>}
            {data.results.map((r) => (
              <div key={r.variantId} className="rounded-md border border-border px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <NetworkBadge network={r.network} />
                  <span className="text-xs text-muted-foreground">{r.brandName}</span>
                </div>
                <div className="mt-1 truncate font-medium">{r.topic}</div>
                <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                  <span><Send className="mr-1 inline size-3" />{fmtNumber(r.metrics?.impressions)}</span>
                  <span>♥ {fmtNumber(r.metrics?.likes)}</span>
                  <span>💬 {fmtNumber(r.metrics?.comments)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
