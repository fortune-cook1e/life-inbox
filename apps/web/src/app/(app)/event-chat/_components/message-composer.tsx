import { zodResolver } from "@hookform/resolvers/zod";
import { Textarea } from "@/components/ui/textarea";
import { type KeyboardEvent, useEffect, useRef } from "react";
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
  prefillContent: string | null;
  recoveryContent: string | null;
  disabled: boolean;
  refreshRequired: boolean;
  onPrefillApplied: () => void;
  onRecoveryApplied: () => void;
  onSubmit: (content: string) => Promise<void>;
}

export function MessageComposer({
  prefillContent,
  recoveryContent,
  disabled,
  refreshRequired,
  onPrefillApplied,
  onRecoveryApplied,
  onSubmit,
}: MessageComposerProps) {
  const submissionLockRef = useRef(false);
  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    control,
    formState: { errors, isSubmitting: isFormSubmitting },
  } = useForm<MessageFormValues>({
    resolver: zodResolver(messageFormSchema),
    defaultValues: { content: "" },
    mode: "onChange",
  });
  const content = useWatch({ control, name: "content" });

  useEffect(() => {
    if (recoveryContent !== null) {
      reset({ content: recoveryContent });
      setFocus("content");
      onRecoveryApplied();
      if (prefillContent !== null) onPrefillApplied();
      return;
    }

    if (prefillContent === null) return;

    reset({ content: prefillContent });
    setFocus("content");
    onPrefillApplied();
  }, [onPrefillApplied, onRecoveryApplied, prefillContent, recoveryContent, reset, setFocus]);

  async function submitMessage(values: MessageFormValues) {
    if (submissionLockRef.current) return;

    submissionLockRef.current = true;
    try {
      reset({ content: "" });
      await onSubmit(values.content);
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
    <div className="shrink-0 bg-background px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-4">
      <form
        onSubmit={handleSubmit(submitMessage)}
        className="mx-auto max-w-3xl"
        aria-label="Send a message"
        noValidate
      >
        <div className="rounded-2xl border border-border bg-card p-2 transition-[border-color,box-shadow] focus-within:border-ring focus-within:shadow-sm motion-reduce:transition-none">
          <Textarea
            {...register("content")}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            maxLength={10_000}
            rows={1}
            aria-label="Message the assistant"
            aria-invalid={Boolean(errors.content)}
            aria-describedby={errors.content ? "composer-error" : "composer-hint"}
            placeholder={
              refreshRequired
                ? "Reload the conversation to continue"
                : "Tell the assistant what you need to remember"
            }
            className="field-sizing-content max-h-40 min-h-11 resize-none border-0 bg-transparent px-3 py-2.5 text-base leading-6 shadow-none focus-visible:border-transparent focus-visible:ring-0 disabled:bg-transparent sm:text-[15px]"
          />
          <div className="px-3 pb-1">
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
          </div>
        </div>
        <p className="mt-2 px-2 text-center text-[11px] leading-4 text-muted-foreground">
          Drafts only. Your calendar stays unchanged until you confirm.
        </p>
      </form>
    </div>
  );
}
