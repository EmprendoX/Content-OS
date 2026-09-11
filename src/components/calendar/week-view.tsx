import Link from "next/link";
import { addDays, format, isSameDay, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StateBadge } from "@/components/shared/state-badge";
import { NETWORK_SPECS } from "@/lib/networks";
import type { CalendarItem } from "@/lib/queries";
import { cn } from "@/lib/utils";

export function WeekView({ weekStart, offset, items }: { weekStart: string; offset: number; items: CalendarItem[] }) {
  const start = parseISO(weekStart);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const end = addDays(start, 6);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm font-medium">
          {format(start, "d MMM", { locale: es })} – {format(end, "d MMM yyyy", { locale: es })}
        </div>
        <div className="flex items-center gap-1">
          <Button asChild size="icon-sm" variant="outline" aria-label="Semana anterior"><Link href={`/calendar?w=${offset - 1}`}><ChevronLeft /></Link></Button>
          <Button asChild size="sm" variant="outline"><Link href="/calendar">Hoy</Link></Button>
          <Button asChild size="icon-sm" variant="outline" aria-label="Semana siguiente"><Link href={`/calendar?w=${offset + 1}`}><ChevronRight /></Link></Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
        {days.map((day) => {
          const dayItems = items.filter((it) => isSameDay(parseISO(it.at), day));
          const today = isSameDay(day, new Date());
          return (
            <div key={day.toISOString()} className={cn("min-h-64 rounded-lg border p-2", today ? "border-primary/50 bg-primary/5" : "border-border")}>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-xs font-medium uppercase text-muted-foreground">{format(day, "EEEE", { locale: es })}</span>
                <span className={cn("text-sm font-semibold", today && "text-primary")}>{format(day, "d")}</span>
              </div>
              <div className="space-y-1.5">
                {dayItems.length === 0 && <div className="text-xs text-muted-foreground">—</div>}
                {dayItems.map((it) => (
                  <Link key={it.id} href={`/studio/${it.pieceId}`} className="block rounded-md border border-border bg-background p-2 text-xs transition-colors hover:bg-muted/50">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-medium">{format(parseISO(it.at), "HH:mm")}</span>
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <span className="inline-block size-2 rounded-full" style={{ backgroundColor: it.brandColor }} />
                        {NETWORK_SPECS[it.network].label}
                      </span>
                    </div>
                    <div className="mt-1 line-clamp-2">{it.topic}</div>
                    <div className="mt-1"><StateBadge state={it.status} className="h-4 px-1.5 text-[10px]" /></div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
