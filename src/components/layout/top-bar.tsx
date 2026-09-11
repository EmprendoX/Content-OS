import Link from "next/link";
import { ShieldCheck, ShieldOff, FlaskConical, Cpu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LlmProviderName } from "@/lib/settings";

interface TopBarProps {
  publishingEnabled: boolean;
  globalDryRun: boolean;
  provider: LlmProviderName;
}

const PROVIDER_LABEL: Record<LlmProviderName, string> = {
  mock: "Mock",
  anthropic: "Anthropic",
  openai: "OpenAI",
  ollama: "Ollama",
};

export function TopBar({ publishingEnabled, globalDryRun, provider }: TopBarProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-6 lg:px-8">
      <div className="text-sm text-muted-foreground">
        Solo accesible desde <span className="font-mono text-foreground">localhost</span>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/settings" className="contents">
          <Badge variant="outline" className="gap-1.5">
            <Cpu className="size-3" />
            IA: {PROVIDER_LABEL[provider]}
          </Badge>
        </Link>
        {globalDryRun && (
          <Badge variant="secondary" className="gap-1.5">
            <FlaskConical className="size-3" />
            Dry Run global
          </Badge>
        )}
        <Link href="/settings" className="contents">
          {publishingEnabled ? (
            <Badge className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-600">
              <ShieldCheck className="size-3" />
              Publicación activa
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1.5">
              <ShieldOff className="size-3" />
              Publicación desactivada
            </Badge>
          )}
        </Link>
      </div>
    </header>
  );
}
