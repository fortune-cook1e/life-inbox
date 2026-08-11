import { describe, expect, it } from "vitest";

import { isClarificationAnswerCompatible } from "../src/agent/clarification-compatibility.js";

const campusCandidate = {
  eventTitle: "Go to the campus",
  eventLocation: "Campus",
};
const dentistCandidate = {
  eventTitle: "Visit the dentist",
  eventLocation: null,
};

describe("clarification compatibility", () => {
  it("allows a value-only answer when exactly one candidate is visible", () => {
    expect(
      isClarificationAnswerCompatible({
        userText: "Use this time: 10 AM",
        evidence: "10 AM",
        ...campusCandidate,
        candidateCount: 1,
        hasMoreCandidates: false,
      }),
    ).toBe(true);
  });

  it("rejects a bare value when multiple candidates are visible", () => {
    for (const candidate of [campusCandidate, dentistCandidate]) {
      expect(
        isClarificationAnswerCompatible({
          userText: "At 10 AM",
          evidence: "10 AM",
          ...candidate,
          candidateCount: 2,
          hasMoreCandidates: false,
        }),
      ).toBe(false);
    }
  });

  it("rejects a bare value when additional candidates are hidden", () => {
    expect(
      isClarificationAnswerCompatible({
        userText: "At 10 AM",
        evidence: "10 AM",
        ...campusCandidate,
        candidateCount: 1,
        hasMoreCandidates: true,
      }),
    ).toBe(false);
  });

  it("uses an explicit matter reference to select only the matching candidate", () => {
    const input = {
      userText: "For the campus event, use 10 AM",
      evidence: "10 AM",
      candidateCount: 2,
      hasMoreCandidates: false,
    };

    expect(isClarificationAnswerCompatible({ ...input, ...campusCandidate })).toBe(true);
    expect(isClarificationAnswerCompatible({ ...input, ...dentistCandidate })).toBe(false);
  });

  it("does not attach a clear new-matter request to an existing candidate", () => {
    expect(
      isClarificationAnswerCompatible({
        userText: "Remind me to call the dentist on August 22, 2026",
        evidence: "August 22, 2026",
        ...campusCandidate,
        candidateCount: 1,
        hasMoreCandidates: false,
      }),
    ).toBe(false);
  });
});
