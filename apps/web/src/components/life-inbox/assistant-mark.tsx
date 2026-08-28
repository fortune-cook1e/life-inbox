import { Check } from "lucide-react";

export function AssistantMark() {
  return (
    <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(35,31,24,0.12)]">
      <Check className="size-4" strokeWidth={2.4} aria-hidden="true" />
    </div>
  );
}
