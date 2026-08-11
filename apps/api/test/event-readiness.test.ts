import { describe, expect, it } from "vitest";

import { evaluateEventCandidate } from "../src/events/event-readiness.js";

const validCandidate = {
  title: "Do the laundry",
  startAt: new Date("2026-08-01T17:00:00.000Z"),
  startAtPrecision: "DATE_TIME" as const,
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
        endAtPrecision: null,
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
        startAtPrecision: null,
        endAt: null,
        endAtPrecision: null,
        timeZone: "Europe/Stockholm",
        location: null,
      },
    });
  });

  it("keeps a date-only default timestamp in COLLECTING", () => {
    expect(
      evaluateEventCandidate({
        title: "Go to the campus",
        startAt: new Date("2026-08-14T07:00:00.000Z"),
        startAtPrecision: "DATE_ONLY",
        timeZone: "Europe/Stockholm",
      }),
    ).toMatchObject({
      valid: true,
      status: "COLLECTING",
      candidate: {
        startAt: new Date("2026-08-14T07:00:00.000Z"),
        startAtPrecision: "DATE_ONLY",
      },
    });
  });

  it("keeps an explicit date-only end in COLLECTING", () => {
    expect(
      evaluateEventCandidate({
        ...validCandidate,
        endAt: new Date("2026-08-03T07:00:00.000Z"),
        endAtPrecision: "DATE_ONLY",
      }),
    ).toMatchObject({
      valid: true,
      status: "COLLECTING",
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
      candidate: {
        ...validCandidate,
        endAt: new Date("invalid"),
        endAtPrecision: "DATE_TIME" as const,
      },
      issue: "INVALID_END_AT",
    },
    {
      name: "endAt without startAt",
      candidate: {
        title: "Do the laundry",
        endAt: new Date(),
        endAtPrecision: "DATE_TIME" as const,
        timeZone: "Europe/Stockholm",
      },
      issue: "END_AT_REQUIRES_START_AT",
    },
    {
      name: "endAt before startAt",
      candidate: {
        ...validCandidate,
        endAt: new Date("2026-08-01T16:00:00.000Z"),
        endAtPrecision: "DATE_TIME" as const,
      },
      issue: "END_AT_NOT_AFTER_START_AT",
    },
    {
      name: "an invalid time zone",
      candidate: { ...validCandidate, timeZone: "Stockholm" },
      issue: "INVALID_TIME_ZONE",
    },
  ])("rejects $name instead of returning COLLECTING", ({ candidate, issue }) => {
    expect(evaluateEventCandidate(candidate)).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([issue]),
    });
  });
});
