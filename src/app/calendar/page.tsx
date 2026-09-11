import { PageHeader } from "@/components/shared/page-header";
import { WeekView } from "@/components/calendar/week-view";
import { currentWeekStart, listCalendarItems } from "@/lib/queries";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const { w } = await searchParams;
  const offset = Number(w ?? 0) || 0;
  const weekStart = currentWeekStart(offset);
  const items = listCalendarItems(weekStart);
  return (
    <div>
      <PageHeader title="Calendario" description="Vista semanal de contenido programado y publicado. Programa desde la hoja de aprobación." />
      <WeekView weekStart={weekStart.toISOString()} offset={offset} items={items} />
    </div>
  );
}
