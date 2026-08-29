import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EventDraftPayload, UpdateEventDraftInput } from "@/types/messages";
import { AlertCircle, LoaderCircle, X } from "lucide-react";
import { type ReactNode, useId, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { toApiDateTime, toFormDateTime } from "./event-draft-card.utils";

const localDateTimeSchema = z
  .string()
  .min(1, "Choose a date and start time.")
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/, "Enter a valid local date and time.");

const optionalLocalDateTimeSchema = z
  .string()
  .refine(
    (value) => value === "" || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value),
    "Enter a valid local date and time.",
  );

const eventDraftFormSchema = z
  .object({
    title: z.string().trim().min(1, "Enter an event title."),
    startAt: localDateTimeSchema,
    endAt: optionalLocalDateTimeSchema,
    timezone: z
      .string()
      .trim()
      .min(1, "Enter a timezone.")
      .refine(isValidTimeZone, "Use a valid IANA timezone, such as Europe/Stockholm."),
    location: z.string().trim(),
    description: z.string().trim(),
  })
  .refine(({ startAt, endAt }) => endAt === "" || startAt === "" || endAt >= startAt, {
    path: ["endAt"],
    message: "End time must be the same as or later than the start time.",
  });

type EventDraftFormValues = z.infer<typeof eventDraftFormSchema>;

interface EventDraftEditorProps {
  payload: EventDraftPayload;
  disabled: boolean;
  isSaving: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (input: UpdateEventDraftInput) => Promise<void>;
}

export function EventDraftEditor({
  payload,
  disabled,
  isSaving,
  error,
  onCancel,
  onSave,
}: EventDraftEditorProps) {
  const formId = useId();
  const submissionLockRef = useRef(false);
  const focusTitle = !payload.title?.trim() || Boolean(payload.startAt);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EventDraftFormValues>({
    resolver: zodResolver(eventDraftFormSchema),
    defaultValues: {
      title: payload.title ?? "",
      startAt: toFormDateTime(payload.startAt),
      endAt: toFormDateTime(payload.endAt),
      timezone: payload.timezone,
      location: payload.location ?? "",
      description: payload.description ?? "",
    },
    mode: "onTouched",
  });

  async function saveDraft(values: EventDraftFormValues) {
    if (submissionLockRef.current) return;

    submissionLockRef.current = true;
    try {
      await onSave({
        title: values.title,
        startAt: toApiDateTime(values.startAt),
        endAt: toApiDateTime(values.endAt),
        timezone: values.timezone,
        location: values.location || null,
        description: values.description || null,
      });
    } finally {
      submissionLockRef.current = false;
    }
  }

  return (
    <section aria-label="Edit calendar event draft" className="w-full max-w-xl">
      <Card className="gap-0 rounded-2xl border border-border py-0 shadow-sm ring-0">
        <CardHeader className="flex flex-row items-center justify-between gap-3 rounded-t-2xl bg-accent/55 px-4 py-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Editing calendar draft</p>
            <h2 className="mt-0.5 text-[15px] font-semibold">Review every value before saving</h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onCancel}
            disabled={isSaving || isSubmitting}
            aria-label="Cancel editing"
            className="text-muted-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </CardHeader>

        <form onSubmit={handleSubmit(saveDraft)} noValidate>
          <CardContent className="grid gap-3.5 px-4 py-3.5 sm:grid-cols-2">
            <DraftField
              id={`${formId}-title`}
              label="Title"
              error={errors.title?.message}
              required
              className="sm:col-span-2"
            >
              <Input
                id={`${formId}-title`}
                autoFocus={focusTitle}
                autoComplete="off"
                required
                aria-required="true"
                disabled={disabled || isSaving || isSubmitting}
                aria-invalid={Boolean(errors.title)}
                aria-describedby={errors.title ? `${formId}-title-error` : undefined}
                className="h-10 rounded-xl"
                {...register("title")}
              />
            </DraftField>

            <DraftField
              id={`${formId}-start-at`}
              label="Start"
              error={errors.startAt?.message}
              required
            >
              <Input
                id={`${formId}-start-at`}
                type="datetime-local"
                autoFocus={!focusTitle}
                step="1"
                required
                aria-required="true"
                disabled={disabled || isSaving || isSubmitting}
                aria-invalid={Boolean(errors.startAt)}
                aria-describedby={errors.startAt ? `${formId}-start-at-error` : undefined}
                className="h-10 rounded-xl"
                {...register("startAt")}
              />
            </DraftField>

            <DraftField id={`${formId}-end-at`} label="End" error={errors.endAt?.message}>
              <Input
                id={`${formId}-end-at`}
                type="datetime-local"
                step="1"
                disabled={disabled || isSaving || isSubmitting}
                aria-invalid={Boolean(errors.endAt)}
                aria-describedby={errors.endAt ? `${formId}-end-at-error` : undefined}
                className="h-10 rounded-xl"
                {...register("endAt")}
              />
            </DraftField>

            <DraftField
              id={`${formId}-timezone`}
              label="Timezone"
              error={errors.timezone?.message}
              required
              className="sm:col-span-2"
            >
              <Input
                id={`${formId}-timezone`}
                autoComplete="off"
                required
                aria-required="true"
                disabled={disabled || isSaving || isSubmitting}
                aria-invalid={Boolean(errors.timezone)}
                aria-describedby={errors.timezone ? `${formId}-timezone-error` : undefined}
                className="h-10 rounded-xl"
                {...register("timezone")}
              />
            </DraftField>

            <DraftField
              id={`${formId}-location`}
              label="Location"
              error={errors.location?.message}
              className="sm:col-span-2"
            >
              <Input
                id={`${formId}-location`}
                autoComplete="off"
                disabled={disabled || isSaving || isSubmitting}
                aria-invalid={Boolean(errors.location)}
                className="h-10 rounded-xl"
                {...register("location")}
              />
            </DraftField>

            <DraftField
              id={`${formId}-description`}
              label="Description"
              error={errors.description?.message}
              className="sm:col-span-2"
            >
              <Textarea
                id={`${formId}-description`}
                rows={3}
                disabled={disabled || isSaving || isSubmitting}
                aria-invalid={Boolean(errors.description)}
                className="min-h-24 resize-y rounded-xl"
                {...register("description")}
              />
            </DraftField>
          </CardContent>

          {error ? (
            <Alert variant="destructive" className="mx-4 mb-3 w-auto sm:mx-5">
              <AlertCircle aria-hidden="true" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <CardFooter className="justify-end gap-2 rounded-b-2xl bg-transparent px-4 py-3">
            <Button
              type="button"
              variant="secondary"
              size="default"
              onClick={onCancel}
              disabled={isSaving || isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" size="default" disabled={disabled || isSaving || isSubmitting}>
              {isSaving || isSubmitting ? (
                <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />
              ) : null}
              Save changes
            </Button>
          </CardFooter>
        </form>
      </Card>
    </section>
  );
}

interface DraftFieldProps {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

function DraftField({
  id,
  label,
  error,
  required = false,
  className = "",
  children,
}: DraftFieldProps) {
  return (
    <div className={`grid gap-1.5 ${className}`}>
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs leading-5 text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}
