import { describe, expect, it } from "vitest";

import {
  clarificationEvidenceIsSupported,
  findClockTimeMismatch,
  groundEventProposal,
} from "../src/events/event-evidence.js";

describe("Event evidence", () => {
  it("keeps a date-only value at 09:00 while marking its precision", () => {
    const result = groundEventProposal(
      "Remind me to go to the campus next Friday",
      "Europe/Stockholm",
      new Date("2026-08-06T19:00:00.000Z"),
      {
        title: "Go to the campus",
        startAt: new Date("2026-08-14T07:00:00.000Z"),
        endAt: null,
        location: "Campus",
        evidence: {
          title: "go to the campus",
          date: "next Friday",
          time: null,
          endDate: null,
          endTimeOrDuration: null,
          location: "campus",
        },
      },
    );

    expect(result).toEqual({
      valid: true,
      candidate: {
        title: "Go to the campus",
        startAt: new Date("2026-08-14T07:00:00.000Z"),
        startAtPrecision: "DATE_ONLY",
        endAt: null,
        endAtPrecision: null,
        timeZone: "Europe/Stockholm",
        location: "Campus",
      },
    });
  });

  it("rejects a resolved timestamp whose local weekday contradicts the evidence", () => {
    const result = groundEventProposal(
      "Remind me to visit the dentist next Friday at 10 AM",
      "Europe/Stockholm",
      new Date("2026-08-06T19:00:00.000Z"),
      {
        title: "Visit the dentist",
        startAt: new Date("2026-08-13T08:00:00.000Z"),
        endAt: null,
        location: null,
        evidence: {
          title: "visit the dentist",
          date: "next Friday",
          time: "10 AM",
          endDate: null,
          endTimeOrDuration: null,
          location: null,
        },
      },
    );

    expect(result).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        {
          field: "startAt",
          reason: "WEEKDAY_MISMATCH",
          expectedWeekday: "Friday",
          actualWeekday: "Thursday",
        },
      ]),
    });
  });

  it("accepts a matching date and time with exact source evidence", () => {
    const startAt = new Date("2026-08-14T08:00:00.000Z");
    const result = groundEventProposal(
      "Remind me to visit the dentist next Friday at 10 AM",
      "Europe/Stockholm",
      new Date("2026-08-06T19:00:00.000Z"),
      {
        title: "Visit the dentist",
        startAt,
        endAt: null,
        location: null,
        evidence: {
          title: "visit the dentist",
          date: "next Friday",
          time: "10 AM",
          endDate: null,
          endTimeOrDuration: null,
          location: null,
        },
      },
    );

    expect(result).toMatchObject({
      valid: true,
      candidate: {
        title: "Visit the dentist",
        startAt,
        startAtPrecision: "DATE_TIME",
        endAt: null,
        endAtPrecision: null,
        timeZone: "Europe/Stockholm",
        location: null,
      },
    });
  });

  it("rejects the nearest Friday because next Friday means the following calendar week", () => {
    const result = groundEventProposal(
      "Remind me to visit the dentist next Friday at 10 AM",
      "Europe/Stockholm",
      new Date("2026-08-06T19:00:00.000Z"),
      {
        title: "Visit the dentist",
        startAt: new Date("2026-08-07T08:00:00.000Z"),
        endAt: null,
        location: null,
        evidence: {
          title: "visit the dentist",
          date: "next Friday",
          time: "10 AM",
          endDate: null,
          endTimeOrDuration: null,
          location: null,
        },
      },
    );

    expect(result).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        {
          field: "startAt",
          reason: "DATE_MISMATCH",
          expectedDate: "2026-08-14",
          actualDate: "2026-08-07",
        },
      ]),
    });
  });

  it("rejects a clock time that contradicts the quoted time evidence", () => {
    const result = groundEventProposal(
      "Remind me to visit the dentist next Friday at 10 AM",
      "Europe/Stockholm",
      new Date("2026-08-06T19:00:00.000Z"),
      {
        title: "Visit the dentist",
        startAt: new Date("2026-08-14T09:00:00.000Z"),
        endAt: null,
        location: null,
        evidence: {
          title: "visit the dentist",
          date: "next Friday",
          time: "10 AM",
          endDate: null,
          endTimeOrDuration: null,
          location: null,
        },
      },
    );

    expect(result).toMatchObject({
      valid: false,
      issues: [
        {
          field: "startAt",
          reason: "CLOCK_TIME_MISMATCH",
          expectedTime: "10:00",
          actualTime: "11:00",
        },
      ],
    });
  });

  it("rejects an endAt that contradicts an explicit duration", () => {
    const result = groundEventProposal(
      "Dentist next Friday at 10 AM for 1 hour",
      "Europe/Stockholm",
      new Date("2026-08-06T19:00:00.000Z"),
      {
        title: "Dentist",
        startAt: new Date("2026-08-14T08:00:00.000Z"),
        endAt: new Date("2026-08-14T10:00:00.000Z"),
        location: null,
        evidence: {
          title: "Dentist",
          date: "next Friday",
          time: "10 AM",
          endDate: null,
          endTimeOrDuration: "for 1 hour",
          location: null,
        },
      },
    );

    expect(result).toMatchObject({
      valid: false,
      issues: [
        {
          field: "endAt",
          reason: "DURATION_MISMATCH",
          expectedMinutes: 60,
          actualMinutes: 120,
        },
      ],
    });
  });

  it("keeps explicit start and end dates with date-only precision", () => {
    const result = groundEventProposal(
      "Campus visit from August 10th to August 12th",
      "Europe/Stockholm",
      new Date("2026-08-06T19:00:00.000Z"),
      {
        title: "Campus visit",
        startAt: new Date("2026-08-10T07:00:00.000Z"),
        endAt: new Date("2026-08-12T07:00:00.000Z"),
        location: "Campus",
        evidence: {
          title: "Campus visit",
          date: "August 10th",
          time: null,
          endDate: "August 12th",
          endTimeOrDuration: null,
          location: "Campus",
        },
      },
    );

    expect(result).toMatchObject({
      valid: true,
      candidate: {
        startAt: new Date("2026-08-10T07:00:00.000Z"),
        startAtPrecision: "DATE_ONLY",
        endAt: new Date("2026-08-12T07:00:00.000Z"),
        endAtPrecision: "DATE_ONLY",
      },
    });
  });

  it("requires a concrete time quote for a startAt clarification", () => {
    expect(clarificationEvidenceIsSupported("Use this time: 10 AM.", "startAt", "10 AM")).toBe(
      true,
    );
    expect(
      clarificationEvidenceIsSupported("Use this time: 10 AM.", "startAt", "next Friday"),
    ).toBe(false);
    expect(clarificationEvidenceIsSupported("Use this time: 10 AM.", "startAt", "11 AM")).toBe(
      false,
    );
    expect(clarificationEvidenceIsSupported("上午10点", "startAt", "上午10点")).toBe(true);
    expect(
      findClockTimeMismatch(
        "startAt",
        "上午10点",
        new Date("2026-08-14T08:00:00.000Z"),
        "Europe/Stockholm",
      ),
    ).toBeNull();
  });
});
