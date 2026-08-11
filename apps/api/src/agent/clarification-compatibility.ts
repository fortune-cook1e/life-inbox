export interface ClarificationRoutingContext {
  userText: string;
  evidence: string;
  eventTitle: string | null;
  eventLocation: string | null;
  candidateCount: number;
  hasMoreCandidates: boolean;
}

const CLEAR_NEW_MATTER_EXPRESSION =
  /\b(?:remind\s+me\s+to|i\s+(?:need|want|plan)\s+to|please\s+(?:schedule|create|add|book))\b|^\s*(?:schedule|create|add|book|call|visit|meet|go)\b/i;

const NON_DISTINCTIVE_CANDIDATE_TOKENS = new Set([
  "a",
  "an",
  "and",
  "appointment",
  "at",
  "book",
  "call",
  "event",
  "for",
  "go",
  "in",
  "meet",
  "meeting",
  "of",
  "on",
  "or",
  "reminder",
  "schedule",
  "task",
  "the",
  "to",
  "visit",
]);

const ANSWER_FRAMING_TOKENS = new Set([
  "after",
  "am",
  "and",
  "answer",
  "april",
  "around",
  "at",
  "august",
  "before",
  "by",
  "change",
  "date",
  "december",
  "february",
  "for",
  "friday",
  "from",
  "gmt",
  "is",
  "it",
  "january",
  "july",
  "june",
  "make",
  "march",
  "may",
  "midnight",
  "monday",
  "next",
  "noon",
  "november",
  "october",
  "on",
  "please",
  "pm",
  "saturday",
  "september",
  "set",
  "sunday",
  "the",
  "this",
  "thursday",
  "time",
  "to",
  "today",
  "tomorrow",
  "tonight",
  "tuesday",
  "until",
  "update",
  "use",
  "utc",
  "wednesday",
]);

/**
 * Determines whether one proposed answer may be attached to a pending Event.
 * This is only an association guard. Field-specific evidence and values still
 * require their normal backend validation before persistence.
 */
export function isClarificationAnswerCompatible({
  userText,
  evidence,
  eventTitle,
  eventLocation,
  candidateCount,
  hasMoreCandidates,
}: ClarificationRoutingContext) {
  const normalizedText = userText.trim();
  const normalizedEvidence = evidence.trim();

  if (
    !normalizedText ||
    !normalizedEvidence ||
    !containsExcerpt(normalizedText, normalizedEvidence) ||
    isClearNewMatter(normalizedText)
  ) {
    return false;
  }

  if (explicitlyReferencesCandidate(normalizedText, eventTitle, eventLocation)) {
    return true;
  }

  return (
    candidateCount === 1 &&
    !hasMoreCandidates &&
    containsOnlyAnswerFraming(normalizedText, normalizedEvidence)
  );
}

function isClearNewMatter(userText: string) {
  return CLEAR_NEW_MATTER_EXPRESSION.test(userText);
}

function explicitlyReferencesCandidate(
  userText: string,
  title: string | null,
  location: string | null,
) {
  const inputTokens = new Set(tokenize(userText));
  const candidateTokens = tokenize([title, location].filter(Boolean).join(" ")).filter(
    (token) => !NON_DISTINCTIVE_CANDIDATE_TOKENS.has(token),
  );

  return candidateTokens.some((token) => inputTokens.has(token));
}

function containsExcerpt(userText: string, evidence: string) {
  return normalizeForExcerpt(userText).includes(normalizeForExcerpt(evidence));
}

function containsOnlyAnswerFraming(userText: string, evidence: string) {
  const normalizedText = normalizeForExcerpt(userText);
  const normalizedEvidence = normalizeForExcerpt(evidence);
  const evidenceIndex = normalizedText.indexOf(normalizedEvidence);
  const surroundingText = `${normalizedText.slice(0, evidenceIndex)} ${normalizedText.slice(
    evidenceIndex + normalizedEvidence.length,
  )}`;

  return tokenize(surroundingText).every(
    (token) => ANSWER_FRAMING_TOKENS.has(token) || /^\d+(?:st|nd|rd|th)?$/.test(token),
  );
}

function normalizeForExcerpt(value: string) {
  return value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

function tokenize(value: string) {
  return value.toLocaleLowerCase("en-US").match(/[\p{L}\p{N}]+/gu) ?? [];
}
