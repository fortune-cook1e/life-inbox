import { Sparkles } from "lucide-react";

export function AssistantMark() {
  return (
    <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
      <Sparkles className="size-4" strokeWidth={2.2} aria-hidden="true" />
    </div>
  );
}
