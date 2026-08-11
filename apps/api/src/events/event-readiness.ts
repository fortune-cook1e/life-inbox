export interface EventCandidate {
  title?: string | null;
  startAt?: Date | null;
  startAtPrecision?: EventTimePrecision | null;
  endAt?: Date | null;
  endAtPrecision?: EventTimePrecision | null;
  timeZone?: string | null;
  location?: string | null;
}

export type EventTimePrecision = "DATE_ONLY" | "DATE_TIME";

export interface NormalizedEventCandidate {
  title: string | null;
  startAt: Date | null;
  startAtPrecision: EventTimePrecision | null;
  endAt: Date | null;
  endAtPrecision: EventTimePrecision | null;
  timeZone: string | null;
  location: string | null;
}

export type EventCandidateStatus = "COLLECTING" | "READY";
export type RequiredEventField = "title" | "startAt" | "endAt" | "timeZone";

export type EventCandidateIssue =
  | "INVALID_START_AT"
  | "INVALID_END_AT"
  | "INVALID_START_AT_PRECISION"
  | "INVALID_END_AT_PRECISION"
  | "START_AT_PRECISION_MISMATCH"
  | "END_AT_PRECISION_MISMATCH"
  | "END_AT_REQUIRES_START_AT"
  | "END_AT_NOT_AFTER_START_AT"
  | "INVALID_TIME_ZONE";

export type EventCandidateEvaluation =
  | {
      valid: false;
      issues: EventCandidateIssue[];
    }
  | {
      valid: true;
      status: EventCandidateStatus;
      candidate: NormalizedEventCandidate;
    };

export function evaluateEventCandidate(candidate: EventCandidate): EventCandidateEvaluation {
  const issues: EventCandidateIssue[] = [];
  const normalized = {
    title: normalizeText(candidate.title),
    startAt: normalizeDate(candidate.startAt, "INVALID_START_AT", issues),
    startAtPrecision: normalizePrecision(
      candidate.startAtPrecision,
      "INVALID_START_AT_PRECISION",
      issues,
    ),
    endAt: normalizeDate(candidate.endAt, "INVALID_END_AT", issues),
    endAtPrecision: normalizePrecision(
      candidate.endAtPrecision,
      "INVALID_END_AT_PRECISION",
      issues,
    ),
    timeZone: normalizeText(candidate.timeZone),
    location: normalizeText(candidate.location),
  } satisfies NormalizedEventCandidate;

  if (Boolean(normalized.startAt) !== Boolean(normalized.startAtPrecision)) {
    issues.push("START_AT_PRECISION_MISMATCH");
  }

  if (Boolean(normalized.endAt) !== Boolean(normalized.endAtPrecision)) {
    issues.push("END_AT_PRECISION_MISMATCH");
  }

  if (normalized.endAt && !normalized.startAt) {
    issues.push("END_AT_REQUIRES_START_AT");
  } else if (normalized.startAt && normalized.endAt && normalized.endAt <= normalized.startAt) {
    issues.push("END_AT_NOT_AFTER_START_AT");
  }

  if (normalized.timeZone && !isValidTimeZone(normalized.timeZone)) {
    issues.push("INVALID_TIME_ZONE");
  }

  if (issues.length > 0) {
    return {
      valid: false,
      issues,
    };
  }

  return {
    valid: true,
    status: determineEventStatus(normalized),
    candidate: normalized,
  };
}

function determineEventStatus(candidate: NormalizedEventCandidate): EventCandidateStatus {
  return getMissingRequiredEventFields(candidate).length === 0 ? "READY" : "COLLECTING";
}

export function getMissingRequiredEventFields(
  candidate: NormalizedEventCandidate,
): RequiredEventField[] {
  const missingFields: RequiredEventField[] = [];

  if (!candidate.title) {
    missingFields.push("title");
  }

  if (!candidate.startAt || candidate.startAtPrecision !== "DATE_TIME") {
    missingFields.push("startAt");
  }

  if (candidate.endAt && candidate.endAtPrecision !== "DATE_TIME") {
    missingFields.push("endAt");
  }

  if (!candidate.timeZone) {
    missingFields.push("timeZone");
  }

  return missingFields;
}

function normalizeText(value: string | null | undefined) {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

function normalizeDate(
  value: Date | null | undefined,
  issue: EventCandidateIssue,
  issues: EventCandidateIssue[],
) {
  if (value === null || value === undefined) {
    return null;
  }

  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    issues.push(issue);
    return null;
  }

  return value;
}

function normalizePrecision(
  value: string | null | undefined,
  issue: EventCandidateIssue,
  issues: EventCandidateIssue[],
): EventTimePrecision | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value !== "DATE_ONLY" && value !== "DATE_TIME") {
    issues.push(issue);
    return null;
  }

  return value;
}

function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
