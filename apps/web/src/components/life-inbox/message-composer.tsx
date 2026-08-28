import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowUp, LoaderCircle } from "lucide-react";
import { type KeyboardEvent, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

const messageFormSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Enter a message before sending.")
    .max(10_000, "Messages must be 10,000 characters or fewer."),
});

type MessageFormValues = z.infer<typeof messageFormSchema>;

interface MessageComposerProps {
  isSubmitting: boolean;
  disabled: boolean;
  refreshRequired: boolean;
  onSubmit: (content: string) => Promise<boolean>;
}

export function MessageComposer({
  isSubmitting,
  disabled,
  refreshRequired,
  onSubmit,
}: MessageComposerProps) {
  const submissionLockRef = useRef(false);
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting: isFormSubmitting, isValid },
  } = useForm<MessageFormValues>({
    resolver: zodResolver(messageFormSchema),
    defaultValues: { content: "" },
    mode: "onChange",
  });
  const content = useWatch({ control, name: "content" });

  async function submitMessage(values: MessageFormValues) {
    if (submissionLockRef.current) return;

    submissionLockRef.current = true;
    try {
      reset({ content: "" });
      const shouldRestoreContent = await onSubmit(values.content);
      if (shouldRestoreContent) reset({ content: values.content });
    } finally {
      submissionLockRef.current = false;
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (!isFormSubmitting && !submissionLockRef.current) {
        event.currentTarget.form?.requestSubmit();
      }
    }
  }

  return (
    <div className="shrink-0 border-t border-border/70 bg-background px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-4">
      <form
        onSubmit={handleSubmit(submitMessage)}
        className="mx-auto max-w-3xl"
        aria-label="Send a message"
        noValidate
      >
        <div className="rounded-[20px] bg-card p-2 shadow-[0_1px_3px_rgba(35,31,24,0.14),0_14px_38px_rgba(35,31,24,0.08)] transition-[box-shadow] focus-within:ring-3 focus-within:ring-ring/35 motion-reduce:transition-none">
          <Textarea
            {...register("content")}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            maxLength={10_000}
            rows={1}
            aria-label="Message LifeInbox"
            aria-invalid={Boolean(errors.content)}
            aria-describedby={errors.content ? "composer-error" : "composer-hint"}
            placeholder={
              refreshRequired
                ? "Reload the conversation to continue"
                : "Tell LifeInbox what you need to remember"
            }
            className="field-sizing-content max-h-40 min-h-11 resize-none border-0 bg-transparent px-3 py-2.5 text-base leading-6 shadow-none focus-visible:border-transparent focus-visible:ring-0 disabled:bg-transparent sm:text-[15px]"
          />
          <div className="flex items-center justify-between gap-3 pl-3">
            {errors.content ? (
              <p id="composer-error" role="alert" className="text-[11px] text-destructive">
                {errors.content.message}
              </p>
            ) : (
              <p id="composer-hint" className="text-[11px] text-muted-foreground">
                {content.length > 9_000
                  ? `${content.length.toLocaleString()} / 10,000`
                  : "Enter to send, Shift+Enter for a new line"}
              </p>
            )}
            <Button
              type="submit"
              size="icon-touch"
              disabled={disabled || isSubmitting || isFormSubmitting || !isValid}
              aria-label="Send message"
              className="shrink-0 shadow-[0_1px_2px_rgba(35,31,24,0.16)]"
            >
              {isSubmitting ? (
                <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />
              ) : (
                <ArrowUp className="size-4.5" strokeWidth={2.4} aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>
        <p className="mt-2 px-2 text-center text-[11px] leading-4 text-muted-foreground">
          Drafts only. Your calendar stays unchanged until you confirm.
        </p>
      </form>
    </div>
  );
}
