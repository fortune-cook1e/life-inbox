import type { EventCandidate, EventTimePrecision } from "./event-readiness.js";

export interface EventProposalEvidence {
  title: string | null;
  date: string | null;
  time: string | null;
  endDate: string | null;
  endTimeOrDuration: string | null;
  location: string | null;
}

export interface EvidenceGroundedEventProposal {
  title: string | null;
  startAt: Date | null;
  endAt: Date | null;
  location: string | null;
  evidence: EventProposalEvidence;
}

export type EventEvidenceIssue =
  | {
      field: "startAt" | "endAt";
      reason: "WEEKDAY_MISMATCH";
      expectedWeekday: string;
      actualWeekday: string;
    }
  | {
      field: "startAt" | "endAt";
      reason: "DATE_MISMATCH";
      expectedDate: string;
      actualDate: string;
    }
  | {
      field: "startAt" | "endAt";
      reason: "CLOCK_TIME_MISMATCH";
      expectedTime: string;
      actualTime: string;
    }
  | {
      field: "endAt";
      reason: "DURATION_MISMATCH";
      expectedMinutes: number;
      actualMinutes: number;
    };

export type GroundEventProposalResult =
  { valid: true; candidate: EventCandidate } | { valid: false; issues: EventEvidenceIssue[] };

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;
const DATE_EXPRESSION = new RegExp(
  String.raw`\b(?:today|tomorrow|tonight|${WEEKDAYS.join("|")}|${MONTHS.join("|")})\b|\b\d{1,4}[/-]\d{1,2}(?:[/-]\d{1,4})?\b`,
  "i",
);
const CLOCK_TIME_EXPRESSION =
  /\b(?:noon|midnight)\b|\b(?:[01]?\d|2[0-3]):[0-5]\d(?:\s*(?:a\.?m\.?|p\.?m\.?))?\b|\b(?:1[0-2]|0?[1-9])\s*(?:a\.?m\.?|p\.?m\.?)\b|\b(?:at|around|by|before|after)\s+(?:[01]?\d|2[0-3])\b|(?:上午|早上|中午|下午|晚上)\s*(?:1[0-2]|0?[1-9])\s*点(?:\s*[0-5]?\d\s*分?)?/i;
const DURATION_EXPRESSION =
  /\b(?:for|until|through|ends?|ending|to)\b[\s\S]*(?:\b(?:minutes?|hours?|days?)\b|\b(?:noon|midnight)\b|\b(?:[01]?\d|2[0-3]):[0-5]\d\b|\b(?:1[0-2]|0?[1-9])\s*(?:a\.?m\.?|p\.?m\.?)\b)/i;

export function groundEventProposal(
  userText: string,
  timeZone: string,
  referenceDate: Date,
  proposal: EvidenceGroundedEventProposal,
): GroundEventProposalResult {
  const titleSupported = supportsExcerpt(userText, proposal.evidence.title);
  const dateSupported = supportsDateEvidence(userText, proposal.evidence.date);
  const timeSupported = supportsTimeEvidence(userText, proposal.evidence.time);
  const endDateSupported = supportsDateEvidence(userText, proposal.evidence.endDate);
  const endSupported =
    supportsExcerpt(userText, proposal.evidence.endTimeOrDuration) &&
    containsEndTimeOrDuration(proposal.evidence.endTimeOrDuration);
  const locationSupported = supportsExcerpt(userText, proposal.evidence.location);
  const startAt = dateSupported ? proposal.startAt : null;
  const startAtPrecision = startAt
    ? timeSupported
      ? ("DATE_TIME" as const)
      : ("DATE_ONLY" as const)
    : null;
  const endAt = startAt && (endDateSupported || endSupported) ? proposal.endAt : null;
  const endAtPrecision = endAt
    ? endSupported
      ? ("DATE_TIME" as const)
      : ("DATE_ONLY" as const)
    : null;
  const issues: EventEvidenceIssue[] = [];

  if (startAt) {
    issues.push(
      ...findDateIssues("startAt", proposal.evidence.date, startAt, timeZone, referenceDate),
    );
    const timeIssue =
      startAtPrecision === "DATE_TIME"
        ? findClockTimeMismatch("startAt", proposal.evidence.time, startAt, timeZone)
        : findDefaultTimeMismatch("startAt", startAt, timeZone);

    if (timeIssue) {
      issues.push(timeIssue);
    }
  }

  if (startAt && endAt) {
    if (endDateSupported) {
      issues.push(
        ...findDateIssues("endAt", proposal.evidence.endDate, endAt, timeZone, referenceDate),
      );
    }

    const endIssue =
      endAtPrecision === "DATE_TIME"
        ? findEndMismatch(proposal.evidence.endTimeOrDuration, startAt, endAt, timeZone)
        : findDefaultTimeMismatch("endAt", endAt, timeZone);

    if (endIssue) {
      issues.push(endIssue);
    }
  }

  if (issues.length > 0) {
    return { valid: false, issues };
  }

  return {
    valid: true,
    candidate: {
      title: titleSupported ? proposal.title : null,
      startAt,
      startAtPrecision,
      endAt,
      endAtPrecision,
      timeZone,
      location: locationSupported ? proposal.location : null,
    },
  };
}

export function clarificationEvidenceIsSupported(
  userText: string,
  field: "title" | "startAt" | "endAt" | "timeZone",
  evidence: string,
) {
  if (!supportsExcerpt(userText, evidence)) {
    return false;
  }

  return field !== "startAt" && field !== "endAt"
    ? true
    : containsDateExpression(evidence) || containsTimeExpression(evidence);
}

export function getTemporalPrecision(evidence: string): EventTimePrecision | null {
  if (containsTimeExpression(evidence)) {
    return "DATE_TIME";
  }

  return containsDateExpression(evidence) ? "DATE_ONLY" : null;
}

export function getTemporalEvidenceParts(evidence: string) {
  return {
    hasDate: containsDateExpression(evidence),
    hasTime: containsTimeExpression(evidence),
  };
}

export function findDateIssues(
  field: "startAt" | "endAt",
  evidenceText: string | null,
  value: Date,
  timeZone: string,
  referenceDate: Date,
): EventEvidenceIssue[] {
  const issues: EventEvidenceIssue[] = [];
  const weekdayIssue = findWeekdayMismatch(field, evidenceText, value, timeZone);
  const relativeDateIssue = findNextWeekdayMismatch(
    field,
    evidenceText,
    value,
    timeZone,
    referenceDate,
  );
  const calendarDateIssue = findCalendarDateMismatch(field, evidenceText, value, timeZone);

  if (weekdayIssue) issues.push(weekdayIssue);
  if (relativeDateIssue) issues.push(relativeDateIssue);
  if (calendarDateIssue) issues.push(calendarDateIssue);

  return issues;
}

export function findWeekdayMismatch(
  field: "startAt" | "endAt",
  evidenceText: string | null,
  value: Date,
  timeZone: string,
): EventEvidenceIssue | null {
  const actual = getLocalDate(value, timeZone);
  const expectedWeekday = WEEKDAYS.find((weekday) =>
    new RegExp(String.raw`\b${weekday}\b`, "i").test(evidenceText ?? ""),
  );

  if (!expectedWeekday || !actual) return null;

  return actual.weekday === expectedWeekday
    ? null
    : {
        field,
        reason: "WEEKDAY_MISMATCH",
        expectedWeekday,
        actualWeekday: actual.weekday,
      };
}

export function findClockTimeMismatch(
  field: "startAt" | "endAt",
  evidenceText: string | null,
  value: Date,
  timeZone: string,
): EventEvidenceIssue | null {
  const expected = parseClockTime(evidenceText);
  const actual = getLocalClockTime(value, timeZone);

  if (!expected || !actual) return null;

  return expected.hour === actual.hour && expected.minute === actual.minute
    ? null
    : {
        field,
        reason: "CLOCK_TIME_MISMATCH",
        expectedTime: formatClockTime(expected),
        actualTime: formatClockTime(actual),
      };
}

export function sameLocalDate(first: Date, second: Date, timeZone: string) {
  const firstDate = getLocalDate(first, timeZone);
  const secondDate = getLocalDate(second, timeZone);

  return Boolean(
    firstDate &&
    secondDate &&
    firstDate.year === secondDate.year &&
    firstDate.month === secondDate.month &&
    firstDate.day === secondDate.day,
  );
}

function findNextWeekdayMismatch(
  field: "startAt" | "endAt",
  evidenceText: string | null,
  value: Date,
  timeZone: string,
  referenceDate: Date,
): EventEvidenceIssue | null {
  const match = evidenceText?.match(
    new RegExp(String.raw`\bnext\s+(${WEEKDAYS.join("|")})\b`, "i"),
  );
  const reference = getLocalDate(referenceDate, timeZone);
  const actual = getLocalDate(value, timeZone);

  if (!match?.[1] || !reference || !actual) return null;

  const weekdayIndex = WEEKDAYS.findIndex(
    (weekday) => weekday.toLocaleLowerCase("en-US") === match[1]?.toLocaleLowerCase("en-US"),
  );
  const referenceDay = new Date(Date.UTC(reference.year, reference.month - 1, reference.day));
  const referenceWeekday = referenceDay.getUTCDay();
  const daysToNextMonday = referenceWeekday === 0 ? 1 : 8 - referenceWeekday;
  const weekdayOffsetFromMonday = weekdayIndex === 0 ? 6 : weekdayIndex - 1;
  const expectedDay = new Date(referenceDay);
  expectedDay.setUTCDate(referenceDay.getUTCDate() + daysToNextMonday + weekdayOffsetFromMonday);
  const expectedDate = formatDate({
    year: expectedDay.getUTCFullYear(),
    month: expectedDay.getUTCMonth() + 1,
    day: expectedDay.getUTCDate(),
  });
  const actualDate = formatDate(actual);

  return expectedDate === actualDate
    ? null
    : { field, reason: "DATE_MISMATCH", expectedDate, actualDate };
}

function findCalendarDateMismatch(
  field: "startAt" | "endAt",
  evidenceText: string | null,
  value: Date,
  timeZone: string,
): EventEvidenceIssue | null {
  const match = evidenceText?.match(
    new RegExp(String.raw`\b(${MONTHS.join("|")})\s+(\d{1,2})(?:st|nd|rd|th)?\b`, "i"),
  );
  const actual = getLocalDate(value, timeZone);

  if (!match?.[1] || !match[2] || !actual) return null;

  const expectedMonth =
    MONTHS.findIndex(
      (month) => month.toLocaleLowerCase("en-US") === match[1]?.toLocaleLowerCase("en-US"),
    ) + 1;
  const expectedDay = Number(match[2]);

  if (actual.month === expectedMonth && actual.day === expectedDay) return null;

  return {
    field,
    reason: "DATE_MISMATCH",
    expectedDate: `${String(expectedMonth).padStart(2, "0")}-${String(expectedDay).padStart(2, "0")}`,
    actualDate: `${String(actual.month).padStart(2, "0")}-${String(actual.day).padStart(2, "0")}`,
  };
}

function findDefaultTimeMismatch(
  field: "startAt" | "endAt",
  value: Date,
  timeZone: string,
): EventEvidenceIssue | null {
  const actual = getLocalClockTime(value, timeZone);

  return actual?.hour === 9 && actual.minute === 0
    ? null
    : {
        field,
        reason: "CLOCK_TIME_MISMATCH",
        expectedTime: "09:00",
        actualTime: actual ? formatClockTime(actual) : "invalid",
      };
}

function findEndMismatch(
  evidenceText: string | null,
  startAt: Date,
  endAt: Date,
  timeZone: string,
): EventEvidenceIssue | null {
  const expectedDurationMinutes = parseDurationMinutes(evidenceText);

  if (expectedDurationMinutes !== null) {
    const actualMinutes = (endAt.getTime() - startAt.getTime()) / 60_000;

    return actualMinutes === expectedDurationMinutes
      ? null
      : {
          field: "endAt",
          reason: "DURATION_MISMATCH",
          expectedMinutes: expectedDurationMinutes,
          actualMinutes,
        };
  }

  return findClockTimeMismatch("endAt", evidenceText, endAt, timeZone);
}

function supportsExcerpt(source: string, excerpt: string | null) {
  return excerpt ? normalizeForMatch(source).includes(normalizeForMatch(excerpt)) : false;
}

function supportsDateEvidence(source: string, evidence: string | null) {
  return supportsExcerpt(source, evidence) && containsDateExpression(evidence);
}

function supportsTimeEvidence(source: string, evidence: string | null) {
  return supportsExcerpt(source, evidence) && containsTimeExpression(evidence);
}

function normalizeForMatch(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function containsDateExpression(value: string | null): value is string {
  return value ? DATE_EXPRESSION.test(value) : false;
}

function containsTimeExpression(value: string | null): value is string {
  return value ? CLOCK_TIME_EXPRESSION.test(value) : false;
}

function containsEndTimeOrDuration(value: string | null): value is string {
  return value ? DURATION_EXPRESSION.test(value) : false;
}

function parseClockTime(value: string | null) {
  if (!value) return null;
  if (/\bnoon\b/i.test(value)) return { hour: 12, minute: 0 };
  if (/\bmidnight\b/i.test(value)) return { hour: 0, minute: 0 };

  const chineseTimeMatch = value.match(
    /(上午|早上|中午|下午|晚上)\s*(1[0-2]|0?[1-9])\s*点(?:\s*([0-5]?\d)\s*分?)?/,
  );

  if (chineseTimeMatch) {
    const period = chineseTimeMatch[1];
    const rawHour = Number(chineseTimeMatch[2]);
    const isPm = period === "中午" || period === "下午" || period === "晚上";

    return {
      hour: rawHour === 12 ? (isPm ? 12 : 0) : rawHour + (isPm ? 12 : 0),
      minute: Number(chineseTimeMatch[3] ?? 0),
    };
  }

  const meridiemMatch = value.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)\b/i);

  if (meridiemMatch) {
    const rawHour = Number(meridiemMatch[1]);
    const isPm = meridiemMatch[3]?.toLocaleLowerCase("en-US").startsWith("p");

    return { hour: (rawHour % 12) + (isPm ? 12 : 0), minute: Number(meridiemMatch[2] ?? 0) };
  }

  const twentyFourHourMatch = value.match(
    /(?:\b(?:at|around|by|before|after)\s+)?\b([01]?\d|2[0-3]):([0-5]\d)\b/i,
  );

  if (twentyFourHourMatch) {
    return { hour: Number(twentyFourHourMatch[1]), minute: Number(twentyFourHourMatch[2]) };
  }

  const contextualHourMatch = value.match(/\b(?:at|around|by|before|after)\s+([01]?\d|2[0-3])\b/i);

  return contextualHourMatch ? { hour: Number(contextualHourMatch[1]), minute: 0 } : null;
}

function parseDurationMinutes(value: string | null) {
  if (!value) return null;

  const durationMatch = value.match(/\bfor\s+(\d+(?:\.\d+)?)\s*(minutes?|hours?)\b/i);
  if (!durationMatch) return null;

  const amount = Number(durationMatch[1]);
  return durationMatch[2]?.toLocaleLowerCase("en-US").startsWith("hour") ? amount * 60 : amount;
}

function getLocalClockTime(value: Date, timeZone: string) {
  if (Number.isNaN(value.getTime())) return null;

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone,
    }).formatToParts(value);
    const hour = parts.find((part) => part.type === "hour")?.value;
    const minute = parts.find((part) => part.type === "minute")?.value;

    return hour && minute ? { hour: Number(hour), minute: Number(minute) } : null;
  } catch {
    return null;
  }
}

function getLocalDate(value: Date, timeZone: string) {
  if (Number.isNaN(value.getTime())) return null;

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "long",
      timeZone,
    }).formatToParts(value);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    const weekday = parts.find((part) => part.type === "weekday")?.value;

    return year && month && day && weekday
      ? { year: Number(year), month: Number(month), day: Number(day), weekday }
      : null;
  } catch {
    return null;
  }
}

function formatClockTime(value: { hour: number; minute: number }) {
  return `${String(value.hour).padStart(2, "0")}:${String(value.minute).padStart(2, "0")}`;
}

function formatDate(value: { year: number; month: number; day: number }) {
  return `${String(value.year).padStart(4, "0")}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
}
