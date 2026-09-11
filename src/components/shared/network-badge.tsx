import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { NETWORK_SPECS, type Network } from "@/lib/networks";

const STYLES: Record<Network, string> = {
  instagram: "bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-200",
  facebook: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  linkedin: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  x: "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900",
  youtube: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
};

export function NetworkBadge({ network, className }: { network: Network; className?: string }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", STYLES[network], className)}>
      {NETWORK_SPECS[network].label}
    </Badge>
  );
}

export function BrandDot({ color, name, className }: { color: string; name?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", className)}>
      <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      {name}
    </span>
  );
}
