import { describe, expect, it } from "vitest";

import { evaluateEventCandidate } from "../src/events/event-readiness.js";

const validCandidate = {
  title: "Do the laundry",
  startAt: new Date("2026-08-01T17:00:00.000Z"),
  timeZone: "Europe/Stockholm",
};

describe("evaluateEventCandidate", () => {
  it("returns READY when every required field is valid", () => {
    expect(evaluateEventCandidate(validCandidate)).toEqual({
      valid: true,
      status: "READY",
      candidate: {
        ...validCandidate,
        endAt: null,
        location: null,
      },
    });
  });

  it("returns COLLECTING for a valid but incomplete candidate", () => {
    expect(
      evaluateEventCandidate({
        title: "Do the laundry",
        timeZone: "Europe/Stockholm",
      }),
    ).toEqual({
      valid: true,
      status: "COLLECTING",
      candidate: {
        title: "Do the laundry",
        startAt: null,
        endAt: null,
        timeZone: "Europe/Stockholm",
        location: null,
      },
    });
  });

  it("trims text and normalizes blank optional text to null", () => {
    expect(
      evaluateEventCandidate({
        ...validCandidate,
        title: "  Do the laundry  ",
        timeZone: "  Europe/Stockholm  ",
        location: "   ",
      }),
    ).toMatchObject({
      valid: true,
      status: "READY",
      candidate: {
        title: "Do the laundry",
        timeZone: "Europe/Stockholm",
        location: null,
      },
    });
  });

  it.each([
    {
      name: "an invalid startAt",
      candidate: { ...validCandidate, startAt: new Date("invalid") },
      issue: "INVALID_START_AT",
    },
    {
      name: "an invalid endAt",
      candidate: { ...validCandidate, endAt: new Date("invalid") },
      issue: "INVALID_END_AT",
    },
    {
      name: "endAt without startAt",
      candidate: { title: "Do the laundry", endAt: new Date(), timeZone: "Europe/Stockholm" },
      issue: "END_AT_REQUIRES_START_AT",
    },
    {
      name: "endAt before startAt",
      candidate: {
        ...validCandidate,
        endAt: new Date("2026-08-01T16:00:00.000Z"),
      },
      issue: "END_AT_NOT_AFTER_START_AT",
    },
    {
      name: "an invalid time zone",
      candidate: { ...validCandidate, timeZone: "Stockholm" },
      issue: "INVALID_TIME_ZONE",
    },
  ])("rejects $name instead of returning COLLECTING", ({ candidate, issue }) => {
    expect(evaluateEventCandidate(candidate)).toEqual({
      valid: false,
      issues: [issue],
    });
  });
});
