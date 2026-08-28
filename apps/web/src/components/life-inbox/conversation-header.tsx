import type { ConnectionState } from "./use-life-inbox";
import { Button } from "@/components/ui/button";
import { Check, RefreshCw } from "lucide-react";

const CONNECTION_META: Record<ConnectionState, { label: string; dotClassName: string }> = {
  checking: {
    label: "Checking connection",
    dotClassName: "bg-amber-500 motion-safe:animate-pulse",
  },
  connected: { label: "Connected", dotClassName: "bg-emerald-600" },
  offline: { label: "API unavailable", dotClassName: "bg-rose-600" },
};

interface ConversationHeaderProps {
  connection: ConnectionState;
  isLoading: boolean;
  isBusy: boolean;
  onReload: () => void;
}

export function ConversationHeader({
  connection,
  isLoading,
  isBusy,
  onReload,
}: ConversationHeaderProps) {
  const connectionMeta = CONNECTION_META[connection];

  return (
    <header className="shrink-0 border-b border-border/80 bg-background">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="grid size-8 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Check className="size-4" strokeWidth={2.5} aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-4">LifeInbox</h1>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Calendar assistant</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div
            className="hidden items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground sm:flex"
            role="status"
          >
            <span
              className={`size-1.5 rounded-full ${connectionMeta.dotClassName}`}
              aria-hidden="true"
            />
            {connectionMeta.label}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-touch"
            onClick={onReload}
            disabled={isBusy}
            aria-label="Reload conversation"
            className="text-muted-foreground"
          >
            <RefreshCw
              className={`size-4 ${isLoading ? "motion-safe:animate-spin" : ""}`}
              aria-hidden="true"
            />
          </Button>
        </div>
      </div>
    </header>
  );
}
