import type { ConversationNotice as Notice } from "@/stores/event-chat-store";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface ConversationNoticeProps {
  notice: Notice;
  refreshRequired: boolean;
  isLoading: boolean;
  onReload: () => void;
}

export function ConversationNotice({
  notice,
  refreshRequired,
  isLoading,
  onReload,
}: ConversationNoticeProps) {
  return (
    <Alert
      role={notice.tone === "error" ? "alert" : "status"}
      variant={notice.tone === "error" ? "destructive" : "default"}
      className={`mt-7 rounded-2xl px-4 py-3.5 ${notice.tone === "error" ? "bg-rose-50 text-rose-950 dark:bg-rose-950/45 dark:text-rose-100" : "border-transparent bg-accent/65 text-accent-foreground"}`}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <AlertTitle>{notice.title}</AlertTitle>
      <AlertDescription className="max-w-[65ch] text-current/75">
        {notice.description}
      </AlertDescription>
      {refreshRequired ? (
        <AlertAction>
          <Button
            type="button"
            variant="ghost"
            size="touch"
            onClick={onReload}
            disabled={isLoading}
            className="text-current"
          >
            Reload
          </Button>
        </AlertAction>
      ) : null}
    </Alert>
  );
}
