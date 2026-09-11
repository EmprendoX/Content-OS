import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATE_LABELS, type ContentState } from "@/lib/workflow/states";

const STYLES: Record<ContentState, string> = {
  IDEA: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200",
  RESEARCHING: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  MASTER_DRAFT: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  ADAPTING: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  IN_REVIEW: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  NEEDS_CHANGES: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  READY_FOR_APPROVAL: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
  APPROVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  SCHEDULED: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200",
  PUBLISHING: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
  PUBLISHED: "bg-green-600 text-white",
  FAILED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
};

export function StateBadge({ state, className }: { state: ContentState; className?: string }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", STYLES[state], className)}>
      {STATE_LABELS[state]}
    </Badge>
  );
}
