import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import process from "node:process";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { MockLanguageModelV4 } from "ai/test";
import { Client } from "pg";
import { afterAll, beforeAll, expect, it } from "vitest";

import { AppModule } from "../src/app.module.js";
import { AGENT_LANGUAGE_MODEL } from "../src/agent/agent.constants.js";
import type { AgentLanguageModelFactory } from "../src/agent/agent-model.provider.js";
import { AgentToolsService } from "../src/agent/agent-tools.service.js";

let app: INestApplication;
let baseUrl: string;
let databaseClient: Client;
let agentToolsService: AgentToolsService;
let toolCallSequence: string[] = [];
let modelPrompts: string[] = [];
let toolCallId = 0;
const agentModel = new MockLanguageModelV4({
  doGenerate: async (options) => {
    const prompt = JSON.stringify(options.prompt);
    modelPrompts.push(prompt);
    const agentInput = getAgentInput(options.prompt);
    const userText = agentInput.userText;
    const nextFridayAtNine = nextCalendarWeekdayAt(
      agentInput.referenceDate,
      agentInput.defaultTimeZone,
      5,
      9,
    );
    const nextFridayAtTen = nextCalendarWeekdayAt(
      agentInput.referenceDate,
      agentInput.defaultTimeZone,
      5,
      10,
    );
    const nextTuesdayAtTen = nextCalendarWeekdayAt(
      agentInput.referenceDate,
      agentInput.defaultTimeZone,
      2,
      10,
    );
    const isDentist = userText === "Remind me to visit the dentist next Friday.";
    const isCompleteDentist = userText === "Remind me to visit the dentist next Friday at 10 AM.";
    const isCampusDateOnly = userText === "Remind me to go to the campus next Friday";
    const isNewDentistWithPending =
      userText === "Remind me to call the dentist on August 22, 2026.";
    const shouldFail = userText.includes("Agent provider should fail.");
    const shouldStayInvalid = userText.includes("Agent keeps proposing invalid data.");
    const shouldPreviewTooEarly = userText.includes("Agent previews too early.");
    const shouldRepeatCase = userText.includes("Agent repeats case creation.");
    const shouldRepeatEvent = userText.includes("Agent repeats event proposal.");
    const isUntitledMatter = userText === "Something happens next Friday.";
    const isLaundryIncomplete = userText === "Remind me to book the laundry room.";
    const isClarificationFragment = userText === "Use this time: 10 AM.";
    const isSelfContainedClarification = userText === "Dentist at 10 AM.";
    const isIncompleteDateClarification = userText === "August 10th";
    const isNoise = userText === "Thanks, that's all.";
    const createdCaseCount = countOccurrences(prompt, '"toolName":"create_case"');
    const proposedEventCount = countOccurrences(prompt, '"toolName":"propose_calendar_event"');
    const hasCreatedCase = createdCaseCount > 0;
    const hasProposedEvent = proposedEventCount > 0;
    const hasShownPreview = prompt.includes('"toolName":"show_event_preview"');
    const hasAppliedClarification = prompt.includes('"toolName":"apply_clarification_answer"');
    const hasCandidate1 = prompt.includes("candidate_1");
    const hasRejectedUnrelatedCandidate = prompt.includes(
      '"reason":"ANSWER_DOES_NOT_REFERENCE_CANDIDATE"',
    );
    const proposalEvidence = {
      title: isUntitledMatter
        ? null
        : isCampusDateOnly
          ? "go to the campus"
          : isNewDentistWithPending
            ? "call the dentist"
            : isDentist || isCompleteDentist
              ? "visit the dentist"
              : "book the laundry room",
      date: isNewDentistWithPending
        ? "August 22, 2026"
        : isDentist || isCompleteDentist || isCampusDateOnly || isUntitledMatter
          ? "next Friday"
          : isLaundryIncomplete
            ? null
            : userText.includes("next Tuesday") || shouldPreviewTooEarly
              ? "next Tuesday"
              : "August 4",
      time: isCompleteDentist
        ? "10 AM"
        : isDentist ||
            isCampusDateOnly ||
            isNewDentistWithPending ||
            isUntitledMatter ||
            isLaundryIncomplete
          ? null
          : "10 AM",
      endDate: null,
      endTimeOrDuration: shouldStayInvalid ? "until 9 AM" : null,
      location: isCampusDateOnly
        ? "campus"
        : isDentist || isCompleteDentist || isNewDentistWithPending || isUntitledMatter
          ? null
          : "laundry room",
    };

    if (isNoise) {
      return toolCall("finish_message_only", {});
    }

    if (isClarificationFragment || isSelfContainedClarification || isIncompleteDateClarification) {
      const hasCandidate2 = prompt.includes("candidate_2");

      if (!hasAppliedClarification) {
        if (isIncompleteDateClarification && hasCandidate1) {
          return toolCall("apply_clarification_answer", {
            candidateToken: "candidate_1",
            field: "startAt",
            value: "2026-08-10T09:00:00+02:00",
            evidence: "August 10th",
          });
        }

        if (isSelfContainedClarification && hasCandidate1) {
          return toolCall("apply_clarification_answer", {
            candidateToken: hasCandidate2 ? "candidate_2" : "candidate_1",
            field: "startAt",
            value: nextFridayAtTen,
            evidence: "10 AM",
          });
        }

        if (hasCandidate1 && !hasCandidate2) {
          return toolCall("apply_clarification_answer", {
            candidateToken: "candidate_1",
            field: "startAt",
            value: nextFridayAtTen,
            evidence: "10 AM",
          });
        }

        return toolCall("request_restatement", {
          message: "Please include both the matter and the time, for example: dentist at 10 AM.",
        });
      }

      if (prompt.includes('"missingFields":["title"]')) {
        return toolCall("ask_user", {
          field: "title",
          question: "What should I call this event?",
        });
      }

      if (isIncompleteDateClarification) {
        return toolCall("ask_user", {
          field: "startAt",
          question: "What time should I use on August 10th?",
        });
      }

      return toolCall("show_event_preview", {});
    }

    if (
      isNewDentistWithPending &&
      hasCandidate1 &&
      !hasCreatedCase &&
      !hasRejectedUnrelatedCandidate
    ) {
      return toolCall("apply_clarification_answer", {
        candidateToken: "candidate_1",
        field: "startAt",
        value: "2026-08-22T09:00:00+02:00",
        evidence: "August 22, 2026",
      });
    }

    if (!hasCreatedCase) {
      return toolCall("create_case", {});
    }

    if (shouldRepeatCase && createdCaseCount === 2) {
      return toolCall("create_case", {});
    }

    if (shouldFail && !hasProposedEvent) {
      throw new Error("OpenAI is unavailable");
    }

    if (shouldPreviewTooEarly && !hasShownPreview) {
      return toolCall("show_event_preview", {});
    }

    if (!hasProposedEvent || shouldStayInvalid) {
      return toolCall("propose_calendar_event", {
        title: shouldStayInvalid
          ? "Book the laundry room"
          : isUntitledMatter
            ? null
            : isCampusDateOnly
              ? "Go to the campus"
              : isNewDentistWithPending
                ? "Call the dentist"
                : isDentist || isCompleteDentist
                  ? "Visit the dentist"
                  : "Book the laundry room",
        startAt:
          isLaundryIncomplete || shouldPreviewTooEarly
            ? null
            : isNewDentistWithPending
              ? "2026-08-22T09:00:00+02:00"
              : isDentist || isUntitledMatter || isCampusDateOnly
                ? nextFridayAtNine
                : isCompleteDentist
                  ? nextFridayAtTen
                  : userText.includes("next Tuesday")
                    ? nextTuesdayAtTen
                    : agentInput.defaultTimeZone === "Asia/Shanghai"
                      ? "2026-08-04T10:00:00+08:00"
                      : "2026-08-04T10:00:00+02:00",
        endAt: shouldStayInvalid ? "2026-08-04T07:00:00.000Z" : null,
        location: isCampusDateOnly
          ? "Campus"
          : isDentist || isCompleteDentist || isNewDentistWithPending
            ? null
            : "Laundry room",
        evidence: proposalEvidence,
      });
    }

    if (shouldRepeatEvent && proposedEventCount === 2) {
      return toolCall("propose_calendar_event", {
        title: "Book the laundry room",
        startAt: "2026-08-04T08:00:00.000Z",
        endAt: null,
        location: "Laundry room",
        evidence: proposalEvidence,
      });
    }

    if (isNewDentistWithPending) {
      return toolCall("ask_user", {
        field: "startAt",
        question: "What time should I use on August 22?",
      });
    }

    if (isDentist || isUntitledMatter || isLaundryIncomplete || shouldPreviewTooEarly) {
      return toolCall("ask_user", {
        field: "startAt",
        question: "What time should I use next Friday?",
      });
    }

    if (isCampusDateOnly && prompt.includes('"status":"COLLECTING"')) {
      return toolCall("ask_user", {
        field: "title",
        question: "What time should I use next Friday?",
      });
    }

    return toolCall("show_event_preview", {});
  },
});

beforeAll(async () => {
  const module = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(AGENT_LANGUAGE_MODEL)
    .useValue((() => ({ model: agentModel })) satisfies AgentLanguageModelFactory)
    .compile();

  agentToolsService = module.get(AgentToolsService);

  app = module.createNestApplication({ logger: false });
  await app.listen(0, "127.0.0.1");

  const address = app.getHttpServer().address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;

  databaseClient = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await databaseClient.connect();
});

afterAll(async () => {
  await databaseClient.end();
  await app.close();
});

it("POST /messages creates one Message, Case, Event, and preview", async () => {
  const clientMessageId = `message-test-${randomUUID()}`;
  const content = "Remind me to book the laundry room next Tuesday at 10 AM.";

  try {
    const before = await countRows(databaseClient);
    const response = await postMessage({
      clientMessageId,
      content,
    });
    const body = (await response.json()) as MessageResponse;

    expect(response.status).toBe(201);
    expect(body).toEqual({
      outcome: "EVENT_PREVIEW",
      message: {
        id: expect.any(String),
        role: "USER",
        kind: "USER_TEXT",
        content,
        createdAt: expect.any(String),
      },
      assistantMessage: {
        id: expect.any(String),
        role: "ASSISTANT",
        kind: "EVENT_PREVIEW",
        content: "Please review this event.",
        createdAt: expect.any(String),
      },
      event: {
        id: expect.any(String),
        status: "READY",
        title: "Book the laundry room",
        startAt: nextCalendarWeekdayAt(body.message.createdAt, "Europe/Stockholm", 2, 10),
        startAtPrecision: "DATE_TIME",
        endAt: null,
        endAtPrecision: null,
        timeZone: "Europe/Stockholm",
        location: "Laundry room",
        version: 1,
      },
    });
    expect(body).not.toHaveProperty("lifeCase");
    expect(body.message).not.toHaveProperty("caseId");
    expect(body.message).not.toHaveProperty("clientMessageId");

    const after = await countRows(databaseClient);

    expect(after.lifeCases).toBe(before.lifeCases + 1);
    expect(after.chatMessages).toBe(before.chatMessages + 2);
    expect(after.events).toBe(before.events + 1);
    expect(after.pendingQuestions).toBe(before.pendingQuestions);
  } finally {
    await cleanupMatter(databaseClient, clientMessageId);
  }
});

it.each([
  {
    content: "Book the laundry room on August 4 at 10 AM. Agent repeats case creation.",
    expectedTools: ["create_case", "create_case", "propose_calendar_event", "show_event_preview"],
  },
  {
    content: "Book the laundry room on August 4 at 10 AM. Agent repeats event proposal.",
    expectedTools: [
      "create_case",
      "propose_calendar_event",
      "propose_calendar_event",
      "show_event_preview",
    ],
  },
])(
  "POST /messages tolerates repeated Agent tool calls for $content",
  async ({ content, expectedTools }) => {
    const clientMessageId = `message-test-${randomUUID()}`;

    try {
      toolCallSequence = [];
      const before = await countRows(databaseClient);
      const response = await postMessage({ clientMessageId, content });
      const body = (await response.json()) as MessageResponse;

      expect(response.status).toBe(201);
      expect(body.assistantMessage.kind).toBe("EVENT_PREVIEW");
      expect(toolCallSequence).toEqual(expectedTools);

      const after = await countRows(databaseClient);

      expect(after.lifeCases).toBe(before.lifeCases + 1);
      expect(after.chatMessages).toBe(before.chatMessages + 2);
      expect(after.events).toBe(before.events + 1);
      expect(after.pendingQuestions).toBe(before.pendingQuestions);
    } finally {
      await cleanupMatter(databaseClient, clientMessageId);
    }
  },
);

it("POST /messages derives a title from a clear user action", async () => {
  const clientMessageId = `message-test-${randomUUID()}`;
  const content = "Remind me to visit the dentist next Friday at 10 AM.";
  const firstModelCall = agentModel.doGenerateCalls.length;

  try {
    toolCallSequence = [];
    modelPrompts = [];
    const response = await postMessage({
      clientMessageId,
      content,
    });
    const body = (await response.json()) as MessageResponse;

    expect(response.status).toBe(201);
    expect(body.outcome).toBe("EVENT_PREVIEW");
    expect(body.assistantMessage).toMatchObject({
      kind: "EVENT_PREVIEW",
    });
    expect(body.event).toMatchObject({
      status: "READY",
      title: "Visit the dentist",
      startAt: nextCalendarWeekdayAt(body.message.createdAt, "Europe/Stockholm", 5, 10),
      endAt: null,
      timeZone: "Europe/Stockholm",
      location: null,
    });
    expect(toolCallSequence).toEqual([
      "create_case",
      "propose_calendar_event",
      "show_event_preview",
    ]);
    expect(agentModel.doGenerateCalls.slice(firstModelCall).map((call) => call.toolChoice)).toEqual(
      [
        { type: "required" },
        { type: "tool", toolName: "propose_calendar_event" },
        { type: "tool", toolName: "show_event_preview" },
      ],
    );
    expect(
      modelPrompts.some((prompt) =>
        prompt.includes(
          "You are responsible for resolving relative dates and converting natural-language dates and times",
        ),
      ),
    ).toBe(true);
    expect(
      modelPrompts.some((prompt) =>
        prompt.includes(
          "Never ask the user to provide ISO 8601, UTC, an offset, or another technical time representation",
        ),
      ),
    ).toBe(true);
  } finally {
    await cleanupMatter(databaseClient, clientMessageId);
  }
});

it("POST /messages stores next Friday at the default time while still asking for an explicit time", async () => {
  const clientMessageId = `message-test-${randomUUID()}`;
  const content = "Remind me to go to the campus next Friday";

  try {
    toolCallSequence = [];
    const response = await postMessage({
      clientMessageId,
      content,
      timeZone: "Europe/Stockholm",
    });
    const body = (await response.json()) as MessageResponse;

    expect(response.status).toBe(201);
    expect(body.outcome).toBe("CLARIFICATION_QUESTION");
    expect(body.event).toMatchObject({
      status: "COLLECTING",
      title: "Go to the campus",
      startAt: nextCalendarWeekdayAt(body.message.createdAt, "Europe/Stockholm", 5, 9),
      startAtPrecision: "DATE_ONLY",
      endAt: null,
      endAtPrecision: null,
      timeZone: "Europe/Stockholm",
      location: "Campus",
    });
    expect(body.assistantMessage).toMatchObject({
      kind: "CLARIFICATION_QUESTION",
      content: "What time should I use next Friday?",
    });
    expect(toolCallSequence).toEqual(["create_case", "propose_calendar_event", "ask_user"]);

    const pendingResult = await databaseClient.query(
      "select expected_field from pending_questions where event_id = $1 and status = 'OPEN'",
      [body.event.id],
    );
    expect(pendingResult.rows[0]).toEqual({ expected_field: "startAt" });
  } finally {
    await cleanupMatter(databaseClient, clientMessageId);
  }
});

it("POST /messages creates a new matter when the Agent first selects an unrelated pending Event", async () => {
  const campusMessageId = `message-test-${randomUUID()}`;
  const dentistMessageId = `message-test-${randomUUID()}`;

  try {
    const campusResponse = await postMessage({
      clientMessageId: campusMessageId,
      content: "Remind me to go to the campus next Friday",
      timeZone: "Europe/Stockholm",
    });
    const campusBody = (await campusResponse.json()) as MessageResponse;

    expect(campusResponse.status).toBe(201);
    expect(campusBody.event).toMatchObject({
      status: "COLLECTING",
      title: "Go to the campus",
      version: 1,
    });

    toolCallSequence = [];
    const dentistResponse = await postMessage({
      clientMessageId: dentistMessageId,
      content: "Remind me to call the dentist on August 22, 2026.",
      timeZone: "Europe/Stockholm",
    });
    const dentistBody = (await dentistResponse.json()) as MessageResponse;

    expect(dentistResponse.status).toBe(201);
    expect(dentistBody.outcome).toBe("CLARIFICATION_QUESTION");
    expect(dentistBody.event).toMatchObject({
      status: "COLLECTING",
      title: "Call the dentist",
      startAt: "2026-08-22T07:00:00.000Z",
      startAtPrecision: "DATE_ONLY",
      version: 1,
    });
    expect(dentistBody.event.id).not.toBe(campusBody.event.id);
    expect(dentistBody.message.kind).toBe("USER_TEXT");
    expect(toolCallSequence).toEqual([
      "apply_clarification_answer",
      "create_case",
      "propose_calendar_event",
      "ask_user",
    ]);

    const eventResult = await databaseClient.query(
      `
        select id, case_id, status, title, version
        from events
        where id = any($1::uuid[])
      `,
      [[campusBody.event.id, dentistBody.event.id]],
    );
    const eventById = new Map(eventResult.rows.map((event) => [event.id, event]));

    expect(eventById.get(campusBody.event.id)).toMatchObject({
      status: "COLLECTING",
      title: "Go to the campus",
      version: 1,
    });
    expect(eventById.get(dentistBody.event.id)).toMatchObject({
      status: "COLLECTING",
      title: "Call the dentist",
      version: 1,
    });
    expect(eventById.get(dentistBody.event.id)?.case_id).not.toBe(
      eventById.get(campusBody.event.id)?.case_id,
    );
    await expect(
      countOpenPendingQuestions(databaseClient, [campusBody.event.id, dentistBody.event.id]),
    ).resolves.toBe(2);
  } finally {
    await cleanupMatter(databaseClient, dentistMessageId);
    await cleanupMatter(databaseClient, campusMessageId);
  }
});

it("POST /messages keeps collecting when a startAt clarification supplies only a new date", async () => {
  const initialMessageId = `message-test-${randomUUID()}`;
  const answerMessageId = `message-test-${randomUUID()}`;

  try {
    const initialResponse = await postMessage({
      clientMessageId: initialMessageId,
      content: "Remind me to go to the campus next Friday",
      timeZone: "Europe/Stockholm",
    });
    const initialBody = (await initialResponse.json()) as MessageResponse;
    const beforeAnswer = await countRows(databaseClient);

    toolCallSequence = [];
    const answerResponse = await postMessage({
      clientMessageId: answerMessageId,
      content: "August 10th",
      timeZone: "Europe/Stockholm",
    });
    const answerBody = (await answerResponse.json()) as MessageResponse;

    expect(answerResponse.status).toBe(201);
    expect(answerBody.outcome).toBe("CLARIFICATION_QUESTION");
    expect(answerBody.message).toMatchObject({
      kind: "CLARIFICATION_ANSWER",
      content: "August 10th",
    });
    expect(answerBody.event).toMatchObject({
      id: initialBody.event.id,
      status: "COLLECTING",
      startAt: "2026-08-10T07:00:00.000Z",
      startAtPrecision: "DATE_ONLY",
      version: 2,
    });
    expect(answerBody.assistantMessage).toMatchObject({
      kind: "CLARIFICATION_QUESTION",
      content: "What time should I use on August 10th?",
    });
    expect(toolCallSequence).toEqual(["apply_clarification_answer", "ask_user"]);

    const afterAnswer = await countRows(databaseClient);
    expect(afterAnswer.lifeCases).toBe(beforeAnswer.lifeCases);
    expect(afterAnswer.events).toBe(beforeAnswer.events);
    expect(afterAnswer.pendingQuestions).toBe(beforeAnswer.pendingQuestions + 1);
  } finally {
    await cleanupMatter(databaseClient, answerMessageId);
    await cleanupMatter(databaseClient, initialMessageId);
  }
});

it("POST /messages creates a collecting Event and asks one clarification question", async () => {
  const clientMessageId = `message-test-${randomUUID()}`;
  const content = "Remind me to visit the dentist next Friday.";

  try {
    toolCallSequence = [];
    const before = await countRows(databaseClient);
    const response = await postMessage({
      clientMessageId,
      content,
    });
    const body = (await response.json()) as MessageResponse;

    expect(response.status).toBe(201);
    expect(body.outcome).toBe("CLARIFICATION_QUESTION");
    expect(body.assistantMessage).toMatchObject({
      role: "ASSISTANT",
      kind: "CLARIFICATION_QUESTION",
      content: "What time should I use next Friday?",
    });
    expect(body.event).toEqual({
      id: expect.any(String),
      status: "COLLECTING",
      title: "Visit the dentist",
      startAt: nextCalendarWeekdayAt(body.message.createdAt, "Europe/Stockholm", 5, 9),
      startAtPrecision: "DATE_ONLY",
      endAt: null,
      endAtPrecision: null,
      timeZone: "Europe/Stockholm",
      location: null,
      version: 1,
    });

    const after = await countRows(databaseClient);

    expect(after.lifeCases).toBe(before.lifeCases + 1);
    expect(after.chatMessages).toBe(before.chatMessages + 2);
    expect(after.events).toBe(before.events + 1);
    expect(after.pendingQuestions).toBe(before.pendingQuestions + 1);
    expect(toolCallSequence).toEqual(["create_case", "propose_calendar_event", "ask_user"]);

    const caseResult = await databaseClient.query("select case_id from events where id = $1", [
      body.event.id,
    ]);
    const repeatedQuestion = await agentToolsService.askUser(
      caseResult.rows[0].case_id,
      body.event.id,
      "startAt",
      "Use a different question.",
    );

    expect(repeatedQuestion).toMatchObject({
      ok: true,
      outcome: {
        assistantMessage: {
          id: body.assistantMessage.id,
          content: "What time should I use next Friday?",
        },
      },
    });
    expect(await countRows(databaseClient)).toEqual(after);
  } finally {
    await cleanupMatter(databaseClient, clientMessageId);
  }
});

it("POST /messages applies one compatible clarification answer to the original Event", async () => {
  const initialMessageId = `message-test-${randomUUID()}`;
  const answerMessageId = `message-test-${randomUUID()}`;

  try {
    const initialResponse = await postMessage({
      clientMessageId: initialMessageId,
      content: "Remind me to visit the dentist next Friday.",
    });
    const initialBody = (await initialResponse.json()) as MessageResponse;
    const candidateResult = await databaseClient.query(
      `
        select
          pq.id as pending_question_id,
          e.case_id
        from pending_questions pq
        inner join events e on e.id = pq.event_id
        where pq.event_id = $1 and pq.status = 'OPEN'
      `,
      [initialBody.event.id],
    );
    const candidate = candidateResult.rows[0];
    const beforeAnswer = await countRows(databaseClient);

    toolCallSequence = [];
    modelPrompts = [];
    const answerResponse = await postMessage({
      clientMessageId: answerMessageId,
      content: "Use this time: 10 AM.",
    });
    const answerBody = (await answerResponse.json()) as MessageResponse;

    expect(answerResponse.status).toBe(201);
    expect(answerBody.outcome).toBe("EVENT_PREVIEW");
    expect(answerBody.message).toMatchObject({
      kind: "CLARIFICATION_ANSWER",
      content: "Use this time: 10 AM.",
    });
    expect(answerBody.event).toMatchObject({
      id: initialBody.event.id,
      status: "READY",
      title: "Visit the dentist",
      startAt: nextCalendarWeekdayAt(initialBody.message.createdAt, "Europe/Stockholm", 5, 10),
      version: 2,
    });
    expect(answerBody.assistantMessage).toMatchObject({
      kind: "EVENT_PREVIEW",
      content: "Please review this event.",
    });
    expect(toolCallSequence).toEqual(["apply_clarification_answer", "show_event_preview"]);

    const searchResultPrompt = modelPrompts.find(
      (prompt) =>
        prompt.includes("candidate_1") &&
        !prompt.includes('"toolName":"apply_clarification_answer"'),
    );

    expect(searchResultPrompt).toContain("Remind me to visit the dentist next Friday.");
    expect(searchResultPrompt).toContain("What time should I use next Friday?");
    expect(searchResultPrompt).not.toContain(candidate.pending_question_id as string);
    expect(searchResultPrompt).not.toContain(candidate.case_id as string);

    const pendingResult = await databaseClient.query(
      `
        select status, event_version, resolved_by_message_id, resolved_at
        from pending_questions
        where id = $1
      `,
      [candidate.pending_question_id],
    );

    expect(pendingResult.rows[0]).toMatchObject({
      status: "RESOLVED",
      event_version: 1,
      resolved_by_message_id: answerBody.message.id,
    });
    expect(pendingResult.rows[0].resolved_at).toBeInstanceOf(Date);

    const afterAnswer = await countRows(databaseClient);

    expect(afterAnswer.lifeCases).toBe(beforeAnswer.lifeCases);
    expect(afterAnswer.events).toBe(beforeAnswer.events);
    expect(afterAnswer.pendingQuestions).toBe(beforeAnswer.pendingQuestions);
    expect(afterAnswer.chatMessages).toBe(beforeAnswer.chatMessages + 2);
  } finally {
    await cleanupMatter(databaseClient, answerMessageId);
    await cleanupMatter(databaseClient, initialMessageId);
  }
});

it("POST /messages opens the next required question when an answer is still incomplete", async () => {
  const initialMessageId = `message-test-${randomUUID()}`;
  const answerMessageId = `message-test-${randomUUID()}`;

  try {
    const initialResponse = await postMessage({
      clientMessageId: initialMessageId,
      content: "Something happens next Friday.",
    });
    const initialBody = (await initialResponse.json()) as MessageResponse;

    toolCallSequence = [];
    const answerResponse = await postMessage({
      clientMessageId: answerMessageId,
      content: "Use this time: 10 AM.",
    });
    const answerBody = (await answerResponse.json()) as MessageResponse;

    expect(answerResponse.status).toBe(201);
    expect(answerBody.outcome).toBe("CLARIFICATION_QUESTION");
    expect(answerBody.message.kind).toBe("CLARIFICATION_ANSWER");
    expect(answerBody.event).toMatchObject({
      id: initialBody.event.id,
      status: "COLLECTING",
      title: null,
      startAt: nextCalendarWeekdayAt(initialBody.message.createdAt, "Europe/Stockholm", 5, 10),
      version: 2,
    });
    expect(answerBody.assistantMessage).toMatchObject({
      kind: "CLARIFICATION_QUESTION",
      content: "What should I call this event?",
    });
    expect(toolCallSequence).toEqual(["apply_clarification_answer", "ask_user"]);

    const pendingResult = await databaseClient.query(
      `
        select status, expected_field, event_version
        from pending_questions
        where event_id = $1
        order by event_version
      `,
      [initialBody.event.id],
    );

    expect(pendingResult.rows).toEqual([
      {
        status: "RESOLVED",
        expected_field: "startAt",
        event_version: 1,
      },
      {
        status: "OPEN",
        expected_field: "title",
        event_version: 2,
      },
    ]);
  } finally {
    await cleanupMatter(databaseClient, answerMessageId);
    await cleanupMatter(databaseClient, initialMessageId);
  }
});

it("POST /messages requests a restatement when two pending matters match a fragment", async () => {
  const dentistMessageId = `message-test-${randomUUID()}`;
  const laundryMessageId = `message-test-${randomUUID()}`;
  const answerMessageId = `message-test-${randomUUID()}`;
  let detachedAssistantMessageId: string | undefined;

  try {
    const dentistResponse = await postMessage({
      clientMessageId: dentistMessageId,
      content: "Remind me to visit the dentist next Friday.",
    });
    const dentistBody = (await dentistResponse.json()) as MessageResponse;
    const laundryResponse = await postMessage({
      clientMessageId: laundryMessageId,
      content: "Remind me to book the laundry room.",
    });
    const laundryBody = (await laundryResponse.json()) as MessageResponse;
    const beforeAnswer = await countRows(databaseClient);

    toolCallSequence = [];
    const answerResponse = await postMessage({
      clientMessageId: answerMessageId,
      content: "Use this time: 10 AM.",
    });
    const answerBody = (await answerResponse.json()) as NullableMessageResponse;
    detachedAssistantMessageId = answerBody.assistantMessage?.id;

    expect(answerResponse.status).toBe(201);
    expect(answerBody).toMatchObject({
      outcome: "RESTATEMENT_REQUIRED",
      message: {
        kind: "USER_TEXT",
      },
      assistantMessage: {
        kind: "CLARIFICATION_QUESTION",
      },
      event: null,
    });
    expect(toolCallSequence).toEqual(["request_restatement"]);

    const storedAnswer = await databaseClient.query(
      "select case_id, kind from chat_messages where client_message_id = $1",
      [answerMessageId],
    );
    expect(storedAnswer.rows[0]).toEqual({ case_id: null, kind: "USER_TEXT" });

    const afterAnswer = await countRows(databaseClient);

    expect(afterAnswer.lifeCases).toBe(beforeAnswer.lifeCases);
    expect(afterAnswer.events).toBe(beforeAnswer.events);
    expect(afterAnswer.pendingQuestions).toBe(beforeAnswer.pendingQuestions);
    expect(afterAnswer.chatMessages).toBe(beforeAnswer.chatMessages + 2);
    await expect(
      countOpenPendingQuestions(databaseClient, [dentistBody.event.id, laundryBody.event.id]),
    ).resolves.toBe(2);
  } finally {
    await cleanupMatter(
      databaseClient,
      answerMessageId,
      detachedAssistantMessageId ? [detachedAssistantMessageId] : [],
    );
    await cleanupMatter(databaseClient, laundryMessageId);
    await cleanupMatter(databaseClient, dentistMessageId);
  }
});

it("POST /messages uses a self-contained restatement to update only the identified matter", async () => {
  const dentistMessageId = `message-test-${randomUUID()}`;
  const laundryMessageId = `message-test-${randomUUID()}`;
  const answerMessageId = `message-test-${randomUUID()}`;

  try {
    const dentistResponse = await postMessage({
      clientMessageId: dentistMessageId,
      content: "Remind me to visit the dentist next Friday.",
    });
    const dentistBody = (await dentistResponse.json()) as MessageResponse;
    const laundryResponse = await postMessage({
      clientMessageId: laundryMessageId,
      content: "Remind me to book the laundry room.",
    });
    const laundryBody = (await laundryResponse.json()) as MessageResponse;

    await databaseClient.query(
      `
        update pending_questions
        set created_at = case
          when event_id = $1 then '2099-01-01T10:00:00.000Z'::timestamptz
          else '2099-01-01T10:01:00.000Z'::timestamptz
        end
        where event_id = any($2::uuid[])
      `,
      [dentistBody.event.id, [dentistBody.event.id, laundryBody.event.id]],
    );

    toolCallSequence = [];
    const answerResponse = await postMessage({
      clientMessageId: answerMessageId,
      content: "Dentist at 10 AM.",
    });
    const answerBody = (await answerResponse.json()) as MessageResponse;

    expect(answerResponse.status).toBe(201);
    expect(answerBody.outcome).toBe("EVENT_PREVIEW");
    expect(answerBody.event).toMatchObject({
      id: dentistBody.event.id,
      status: "READY",
      version: 2,
    });
    expect(answerBody.event.id).not.toBe(laundryBody.event.id);
    expect(toolCallSequence).toEqual(["apply_clarification_answer", "show_event_preview"]);

    const eventsResult = await databaseClient.query(
      "select id, status, version from events where id = any($1::uuid[]) order by id",
      [[dentistBody.event.id, laundryBody.event.id]],
    );
    const eventById = new Map(eventsResult.rows.map((event) => [event.id, event]));

    expect(eventById.get(dentistBody.event.id)).toMatchObject({ status: "READY", version: 2 });
    expect(eventById.get(laundryBody.event.id)).toMatchObject({ status: "COLLECTING", version: 1 });
    await expect(
      countOpenPendingQuestions(databaseClient, [dentistBody.event.id, laundryBody.event.id]),
    ).resolves.toBe(1);
  } finally {
    await cleanupMatter(databaseClient, answerMessageId);
    await cleanupMatter(databaseClient, laundryMessageId);
    await cleanupMatter(databaseClient, dentistMessageId);
  }
});

it("POST /messages requests context for an unmatched meaningful fragment", async () => {
  const clientMessageId = `message-test-${randomUUID()}`;
  let detachedAssistantMessageId: string | undefined;

  try {
    const before = await countRows(databaseClient);
    toolCallSequence = [];
    const response = await postMessage({
      clientMessageId,
      content: "Use this time: 10 AM.",
    });
    const body = (await response.json()) as NullableMessageResponse;
    detachedAssistantMessageId = body.assistantMessage?.id;

    expect(response.status).toBe(201);
    expect(body.outcome).toBe("RESTATEMENT_REQUIRED");
    expect(body.assistantMessage).toMatchObject({
      kind: "CLARIFICATION_QUESTION",
    });
    expect(body.event).toBeNull();
    expect(toolCallSequence).toEqual(["request_restatement"]);

    const after = await countRows(databaseClient);
    expect(after.lifeCases).toBe(before.lifeCases);
    expect(after.events).toBe(before.events);
    expect(after.pendingQuestions).toBe(before.pendingQuestions);
    expect(after.chatMessages).toBe(before.chatMessages + 2);
  } finally {
    await cleanupMatter(
      databaseClient,
      clientMessageId,
      detachedAssistantMessageId ? [detachedAssistantMessageId] : [],
    );
  }
});

it("POST /messages stores noise as MESSAGE_ONLY", async () => {
  const clientMessageId = `message-test-${randomUUID()}`;

  try {
    const before = await countRows(databaseClient);
    toolCallSequence = [];
    const response = await postMessage({
      clientMessageId,
      content: "Thanks, that's all.",
    });
    const body = (await response.json()) as NullableMessageResponse;

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      outcome: "MESSAGE_ONLY",
      message: {
        kind: "USER_TEXT",
      },
      assistantMessage: null,
      event: null,
    });
    expect(toolCallSequence).toEqual(["finish_message_only"]);

    const after = await countRows(databaseClient);
    expect(after.lifeCases).toBe(before.lifeCases);
    expect(after.events).toBe(before.events);
    expect(after.pendingQuestions).toBe(before.pendingQuestions);
    expect(after.chatMessages).toBe(before.chatMessages + 1);
  } finally {
    await cleanupMatter(databaseClient, clientMessageId);
  }
});

it("allows only one concurrent answer to resolve a PendingQuestion", async () => {
  const initialMessageId = `message-test-${randomUUID()}`;
  const firstAnswerId = `message-test-${randomUUID()}`;
  const secondAnswerId = `message-test-${randomUUID()}`;

  try {
    const initialResponse = await postMessage({
      clientMessageId: initialMessageId,
      content: "Remind me to visit the dentist next Friday.",
    });
    const initialBody = (await initialResponse.json()) as MessageResponse;
    const targetResult = await databaseClient.query(
      `
        select
          pq.id as pending_question_id,
          pq.expected_field,
          pq.event_id,
          e.case_id
        from pending_questions pq
        inner join events e on e.id = pq.event_id
        where pq.event_id = $1 and pq.status = 'OPEN'
      `,
      [initialBody.event.id],
    );
    const targetRow = targetResult.rows[0];

    await databaseClient.query(
      `
        insert into chat_messages (role, kind, content, client_message_id)
        values
          ('USER', 'USER_TEXT', '10 AM', $1),
          ('USER', 'USER_TEXT', '11 AM', $2)
      `,
      [firstAnswerId, secondAnswerId],
    );
    const answerMessages = await databaseClient.query(
      "select id, client_message_id from chat_messages where client_message_id = any($1::text[])",
      [[firstAnswerId, secondAnswerId]],
    );
    const messageIdByClientId = new Map(
      answerMessages.rows.map((message) => [message.client_message_id, message.id]),
    );
    const target = {
      pendingQuestionId: targetRow.pending_question_id as string,
      eventId: targetRow.event_id as string,
      caseId: targetRow.case_id as string,
      expectedField: targetRow.expected_field as "startAt",
    };

    const results = await Promise.all([
      agentToolsService.applyClarificationAnswer(
        messageIdByClientId.get(firstAnswerId) as string,
        target,
        {
          field: "startAt",
          value: sameLocalDateAt(initialBody.event.startAt!, initialBody.event.timeZone!, 10),
          evidence: "10 AM",
        },
      ),
      agentToolsService.applyClarificationAnswer(
        messageIdByClientId.get(secondAnswerId) as string,
        target,
        {
          field: "startAt",
          value: sameLocalDateAt(initialBody.event.startAt!, initialBody.event.timeZone!, 11),
          evidence: "11 AM",
        },
      ),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toHaveLength(1);

    const storedAnswers = await databaseClient.query(
      `
        select case_id, kind
        from chat_messages
        where client_message_id = any($1::text[])
        order by client_message_id
      `,
      [[firstAnswerId, secondAnswerId]],
    );

    expect(storedAnswers.rows.filter((message) => message.case_id !== null)).toHaveLength(1);
    expect(
      storedAnswers.rows.filter((message) => message.kind === "CLARIFICATION_ANSWER"),
    ).toHaveLength(1);
    expect(storedAnswers.rows.filter((message) => message.case_id === null)).toHaveLength(1);

    const eventResult = await databaseClient.query(
      "select version, status from events where id = $1",
      [initialBody.event.id],
    );
    expect(eventResult.rows[0]).toMatchObject({ version: 2, status: "READY" });
    await expect(countOpenPendingQuestions(databaseClient, [initialBody.event.id])).resolves.toBe(
      0,
    );
  } finally {
    await cleanupMatter(databaseClient, firstAnswerId);
    await cleanupMatter(databaseClient, secondAnswerId);
    await cleanupMatter(databaseClient, initialMessageId);
  }
});

it("POST /messages lets the Agent recover when preview is rejected by backend validation", async () => {
  const clientMessageId = `message-test-${randomUUID()}`;

  try {
    toolCallSequence = [];
    const response = await postMessage({
      clientMessageId,
      content: "Book the laundry room next Tuesday. Agent previews too early.",
    });
    const body = (await response.json()) as MessageResponse;

    expect(response.status).toBe(201);
    expect(body.event.status).toBe("COLLECTING");
    expect(body.assistantMessage.kind).toBe("CLARIFICATION_QUESTION");
    expect(toolCallSequence).toEqual([
      "create_case",
      "show_event_preview",
      "propose_calendar_event",
      "ask_user",
    ]);
  } finally {
    await cleanupMatter(databaseClient, clientMessageId);
  }
});

it("POST /messages prefers the caller's IANA time zone", async () => {
  const clientMessageId = `message-test-${randomUUID()}`;

  try {
    const response = await postMessage({
      clientMessageId,
      content: "Remind me to book the laundry room next Tuesday at 10 AM.",
      timeZone: "Asia/Shanghai",
    });
    const body = (await response.json()) as MessageResponse;

    expect(response.status).toBe(201);
    expect(body.event.timeZone).toBe("Asia/Shanghai");
    expect(body.assistantMessage.content).toBe("Please review this event.");
  } finally {
    await cleanupMatter(databaseClient, clientMessageId);
  }
});

it("POST /messages preserves the user evidence when the Agent provider fails", async () => {
  const clientMessageId = `message-test-${randomUUID()}`;

  try {
    const before = await countRows(databaseClient);
    const response = await postMessage({
      clientMessageId,
      content: "Agent provider should fail.",
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "AGENT_UNAVAILABLE",
      message: "Your message was saved, but the Agent could not finish processing it.",
    });

    const after = await countRows(databaseClient);

    expect(after.lifeCases).toBe(before.lifeCases + 1);
    expect(after.chatMessages).toBe(before.chatMessages + 1);
    expect(after.events).toBe(before.events);
  } finally {
    await cleanupMatter(databaseClient, clientMessageId);
  }
});

it("POST /messages stops after four steps when the Agent keeps proposing invalid data", async () => {
  const clientMessageId = `message-test-${randomUUID()}`;

  try {
    const before = await countRows(databaseClient);
    const response = await postMessage({
      clientMessageId,
      content:
        "Book the laundry room on August 4 from 10 AM until 9 AM. Agent keeps proposing invalid data.",
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "AGENT_STEP_LIMIT_REACHED",
    });

    const after = await countRows(databaseClient);

    expect(after.lifeCases).toBe(before.lifeCases + 1);
    expect(after.chatMessages).toBe(before.chatMessages + 1);
    expect(after.events).toBe(before.events);
  } finally {
    await cleanupMatter(databaseClient, clientMessageId);
  }
});

it.each([
  {
    name: "blank content",
    body: {
      clientMessageId: `message-test-${randomUUID()}`,
      content: "   ",
    },
  },
  {
    name: "the legacy intent property",
    body: {
      intent: "NEW_MATTER",
      clientMessageId: `message-test-${randomUUID()}`,
      content: "Hello.",
    },
  },
  {
    name: "an unknown property",
    body: {
      clientMessageId: `message-test-${randomUUID()}`,
      content: "Remind me to do laundry.",
      caseId: randomUUID(),
    },
  },
  {
    name: "an invalid time zone",
    body: {
      clientMessageId: `message-test-${randomUUID()}`,
      content: "Remind me to do laundry.",
      timeZone: "EU",
    },
  },
])("POST /messages rejects $name", async ({ body }) => {
  const before = await countRows(databaseClient);
  const response = await postMessage(body);

  expect(response.status).toBe(400);
  expect(await countRows(databaseClient)).toEqual(before);
});

it("GET /messages returns the latest page in stable chronological order", async () => {
  const messageIds = [
    "00000000-0000-0000-0000-000000000001",
    "00000000-0000-0000-0000-000000000002",
    "00000000-0000-0000-0000-000000000003",
  ] satisfies [string, string, string];

  try {
    await databaseClient.query(
      `
        insert into chat_messages (
          id,
          role,
          kind,
          content,
          created_at
        )
        values
          ($1, 'SYSTEM', 'STATUS', 'First tied message',  '2099-01-01T10:00:00.000Z'),
          ($2, 'SYSTEM', 'STATUS', 'Second tied message', '2099-01-01T10:00:00.000Z'),
          ($3, 'SYSTEM', 'STATUS', 'Latest message',       '2099-01-01T10:01:00.000Z')
      `,
      messageIds,
    );

    const latestPageResponse = await fetch(`${baseUrl}/messages?limit=2`);
    const latestPage = (await latestPageResponse.json()) as MessagesPageResponse;

    expect(latestPageResponse.status).toBe(200);
    expect(latestPage.items.map((message) => message.id)).toEqual([messageIds[1], messageIds[2]]);
    expect(latestPage.pageInfo).toEqual({
      hasMore: true,
      nextCursor: expect.any(String),
    });

    const olderPageResponse = await fetch(
      `${baseUrl}/messages?limit=2&cursor=${encodeURIComponent(latestPage.pageInfo.nextCursor!)}`,
    );
    const olderPage = (await olderPageResponse.json()) as MessagesPageResponse;

    expect(olderPageResponse.status).toBe(200);
    expect(
      olderPage.items.map((message) => message.id).filter((id) => messageIds.includes(id)),
    ).toEqual([messageIds[0]]);
    expect(olderPage.items.map((message) => message.id)).not.toContain(messageIds[1]);
    expect(olderPage.items.map((message) => message.id)).not.toContain(messageIds[2]);

    const completePageResponse = await fetch(`${baseUrl}/messages?limit=3`);
    const completePage = (await completePageResponse.json()) as MessagesPageResponse;

    expect(completePageResponse.status).toBe(200);
    expect(completePage.items.map((message) => message.id)).toEqual(messageIds);

    for (const message of completePage.items) {
      expect(message).not.toHaveProperty("caseId");
      expect(message).not.toHaveProperty("clientMessageId");
    }

    const oldestResult = await databaseClient.query<{ created_at: Date }>(
      "select min(created_at) as created_at from chat_messages",
    );
    const oldestCreatedAt = oldestResult.rows[0]?.created_at;

    expect(oldestCreatedAt).toBeInstanceOf(Date);

    const exhaustedCursor = Buffer.from(
      JSON.stringify({
        id: "00000000-0000-0000-0000-000000000000",
        createdAt: new Date(oldestCreatedAt!.getTime() - 1).toISOString(),
      }),
    ).toString("base64url");
    const exhaustedPageResponse = await fetch(
      `${baseUrl}/messages?cursor=${encodeURIComponent(exhaustedCursor)}`,
    );
    const exhaustedPage = (await exhaustedPageResponse.json()) as MessagesPageResponse;

    expect(exhaustedPageResponse.status).toBe(200);
    expect(exhaustedPage).toEqual({
      items: [],
      pageInfo: {
        hasMore: false,
        nextCursor: null,
      },
    });
  } finally {
    await databaseClient.query(
      `
        delete from chat_messages
        where id = any($1::uuid[])
      `,
      [messageIds],
    );
  }
});

it.each(["0", "101", "not-a-number"])("GET /messages rejects limit=%s", async (limit) => {
  const response = await fetch(`${baseUrl}/messages?limit=${limit}`);

  expect(response.status).toBe(400);
});

it("GET /messages rejects an invalid cursor", async () => {
  const response = await fetch(`${baseUrl}/messages?cursor=not-a-valid-cursor`);

  expect(response.status).toBe(400);
});

function postMessage(body: object) {
  return fetch(`${baseUrl}/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function getAgentInput(prompt: unknown) {
  if (!Array.isArray(prompt)) {
    throw new Error("The mock Agent prompt is not an array.");
  }

  const userMessage = prompt.find(
    (message): message is Record<string, unknown> =>
      isRecord(message) && message.role === "user" && Array.isArray(message.content),
  );
  const textPart = (userMessage?.content as unknown[] | undefined)?.find(
    (part): part is Record<string, unknown> => isRecord(part) && part.type === "text",
  );

  if (typeof textPart?.text !== "string") {
    throw new Error("The mock Agent prompt does not contain a user text part.");
  }

  const input = JSON.parse(textPart.text) as unknown;

  if (
    !isRecord(input) ||
    typeof input.userText !== "string" ||
    typeof input.defaultTimeZone !== "string" ||
    typeof input.referenceDate !== "string" ||
    Number.isNaN(Date.parse(input.referenceDate))
  ) {
    throw new Error("The mock Agent user text payload is invalid.");
  }

  return {
    userText: input.userText,
    defaultTimeZone: input.defaultTimeZone,
    referenceDate: input.referenceDate,
  };
}

function nextCalendarWeekdayAt(
  referenceDate: string,
  timeZone: string,
  targetWeekday: number,
  hour: number,
) {
  const reference = getZonedDateParts(new Date(referenceDate), timeZone);
  const referenceDay = new Date(Date.UTC(reference.year, reference.month - 1, reference.day));
  const referenceWeekday = referenceDay.getUTCDay();
  const daysToNextMonday = referenceWeekday === 0 ? 1 : 8 - referenceWeekday;
  const weekdayOffsetFromMonday = targetWeekday === 0 ? 6 : targetWeekday - 1;
  const targetDay = new Date(referenceDay);
  targetDay.setUTCDate(referenceDay.getUTCDate() + daysToNextMonday + weekdayOffsetFromMonday);

  return localDateTimeToIso(
    {
      year: targetDay.getUTCFullYear(),
      month: targetDay.getUTCMonth() + 1,
      day: targetDay.getUTCDate(),
      hour,
      minute: 0,
      second: 0,
    },
    timeZone,
  );
}

function sameLocalDateAt(value: string, timeZone: string, hour: number) {
  const localDate = getZonedDateParts(new Date(value), timeZone);

  return localDateTimeToIso(
    {
      ...localDate,
      hour,
      minute: 0,
      second: 0,
    },
    timeZone,
  );
}

function localDateTimeToIso(
  parts: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  },
  timeZone: string,
) {
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  let instant = new Date(localAsUtc);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const offset = getTimeZoneOffsetMilliseconds(instant, timeZone);
    instant = new Date(localAsUtc - offset);
  }

  return instant.toISOString();
}

function getTimeZoneOffsetMilliseconds(value: Date, timeZone: string) {
  const parts = getZonedDateTimeParts(value, timeZone);
  const zonedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const valueWithoutMilliseconds = Math.trunc(value.getTime() / 1000) * 1000;

  return zonedAsUtc - valueWithoutMilliseconds;
}

function getZonedDateParts(value: Date, timeZone: string) {
  const { year, month, day } = getZonedDateTimeParts(value, timeZone);

  return { year, month, day };
}

function getZonedDateTimeParts(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );
  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);
  const hour = Number(values.hour);
  const minute = Number(values.minute);
  const second = Number(values.second);

  if ([year, month, day, hour, minute, second].some(Number.isNaN)) {
    throw new Error(`Could not resolve ${value.toISOString()} in ${timeZone}.`);
  }

  return { year, month, day, hour, minute, second };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

type MockGenerateResult = Awaited<ReturnType<MockLanguageModelV4["doGenerate"]>>;

function toolCall(toolName: string, input: object): MockGenerateResult {
  toolCallSequence.push(toolName);
  toolCallId += 1;

  return {
    content: [
      {
        type: "tool-call",
        toolCallId: `tool-call-${toolCallId}`,
        toolName,
        input: JSON.stringify(input),
      },
    ],
    finishReason: {
      unified: "tool-calls",
      raw: undefined,
    },
    usage: {
      inputTokens: {
        total: 10,
        noCache: 10,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: 10,
        text: 10,
        reasoning: undefined,
      },
    },
    warnings: [],
  };
}

function countOccurrences(value: string, search: string) {
  return value.split(search).length - 1;
}

async function cleanupMatter(
  client: Client,
  clientMessageId: string,
  detachedMessageIds: string[] = [],
) {
  const result = await client.query(
    `
      select case_id
      from chat_messages
      where client_message_id = $1
    `,
    [clientMessageId],
  );

  const caseIds = result.rows.map((row) => row.case_id).filter((caseId) => caseId !== null);

  if (caseIds.length > 0) {
    await client.query(
      `
        delete from pending_questions
        where event_id in (
          select id
          from events
          where case_id = any($1::uuid[])
        )
      `,
      [caseIds],
    );
    await client.query(
      `
        delete from chat_messages
        where case_id = any($1::uuid[])
      `,
      [caseIds],
    );
    await client.query(
      `
        delete from events
        where case_id = any($1::uuid[])
      `,
      [caseIds],
    );
    await client.query(
      `
        delete from life_cases
        where id = any($1::uuid[])
      `,
      [caseIds],
    );
  }

  await client.query(
    `
      delete from chat_messages
      where client_message_id = $1
        or id = any($2::uuid[])
    `,
    [clientMessageId, detachedMessageIds],
  );
}

async function countRows(client: Client) {
  const result = await client.query(`
    select
      (select count(*)::integer from life_cases) as life_cases,
      (select count(*)::integer from chat_messages) as chat_messages,
      (select count(*)::integer from events) as events,
      (select count(*)::integer from pending_questions) as pending_questions
  `);

  return {
    lifeCases: result.rows[0].life_cases as number,
    chatMessages: result.rows[0].chat_messages as number,
    events: result.rows[0].events as number,
    pendingQuestions: result.rows[0].pending_questions as number,
  };
}

async function countOpenPendingQuestions(client: Client, eventIds: string[]) {
  const result = await client.query(
    `
      select count(*)::integer as count
      from pending_questions
      where status = 'OPEN' and event_id = any($1::uuid[])
    `,
    [eventIds],
  );

  return result.rows[0].count as number;
}

interface MessageResponse {
  outcome: "EVENT_PREVIEW" | "CLARIFICATION_QUESTION";
  message: {
    id: string;
    role: "USER";
    kind: "USER_TEXT" | "CLARIFICATION_ANSWER";
    content: string;
    createdAt: string;
  };
  assistantMessage: {
    id: string;
    role: "ASSISTANT";
    kind: "CLARIFICATION_QUESTION" | "EVENT_PREVIEW";
    content: string;
    createdAt: string;
  };
  event: {
    id: string;
    status: "COLLECTING" | "READY";
    title: string | null;
    startAt: string | null;
    startAtPrecision: "DATE_ONLY" | "DATE_TIME" | null;
    endAt: string | null;
    endAtPrecision: "DATE_ONLY" | "DATE_TIME" | null;
    timeZone: string | null;
    location: string | null;
    version: number;
  };
}

interface NullableMessageResponse {
  outcome: "RESTATEMENT_REQUIRED" | "MESSAGE_ONLY";
  message: MessageResponse["message"];
  assistantMessage: MessageResponse["assistantMessage"] | null;
  event: null;
}

interface MessagesPageResponse {
  items: MessageResponse["message"][];
  pageInfo: {
    hasMore: boolean;
    nextCursor: string | null;
  };
}
