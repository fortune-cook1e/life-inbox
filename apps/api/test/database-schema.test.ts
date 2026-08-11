import { randomUUID } from "node:crypto";
import process from "node:process";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { expect, it } from "vitest";

import { events as eventsTable } from "../src/database/schema.js";

it("enforces the first LifeCase, ChatMessage, and Event invariants", async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  const clientMessageId = `schema-test-${randomUUID()}`;

  await client.connect();
  const database = drizzle(client);

  try {
    await client.query("begin");

    const caseResult = await client.query(
      `
        insert into life_cases default values
        returning id, status, resolution, version
      `,
    );
    const lifeCase = caseResult.rows[0];

    expect(lifeCase.status).toBe("OPEN");
    expect(lifeCase.resolution).toBeNull();
    expect(lifeCase.version).toBe(1);

    const eventResult = await client.query(
      `
        insert into events (case_id, updated_at)
        values ($1, '2000-01-01T00:00:00.000Z')
        returning id, status, title, start_at, start_at_precision, end_at,
          end_at_precision, time_zone, location, version, updated_at
      `,
      [lifeCase.id],
    );
    const event = eventResult.rows[0];

    expect(event).toMatchObject({
      status: "COLLECTING",
      title: null,
      start_at: null,
      start_at_precision: null,
      end_at: null,
      end_at_precision: null,
      time_zone: null,
      location: null,
      version: 1,
    });

    const questionMessageResult = await client.query(
      `
        insert into chat_messages (case_id, role, kind, content)
        values ($1, 'ASSISTANT', 'CLARIFICATION_QUESTION', 'What time should I use?')
        returning id
      `,
      [lifeCase.id],
    );
    const questionMessage = questionMessageResult.rows[0];
    const pendingQuestionResult = await client.query(
      `
        insert into pending_questions (
          event_id,
          question_message_id,
          expected_field,
          event_version
        )
        values ($1, $2, 'startAt', 1)
        returning id, status, expected_field, event_version, resolved_by_message_id, resolved_at
      `,
      [event.id, questionMessage.id],
    );
    const pendingQuestion = pendingQuestionResult.rows[0];

    expect(pendingQuestion).toMatchObject({
      status: "OPEN",
      expected_field: "startAt",
      event_version: 1,
      resolved_by_message_id: null,
      resolved_at: null,
    });

    await client.query("savepoint before_second_open_question");
    const secondQuestionMessageResult = await client.query(
      `
        insert into chat_messages (case_id, role, kind, content)
        values ($1, 'ASSISTANT', 'CLARIFICATION_QUESTION', 'Another question')
        returning id
      `,
      [lifeCase.id],
    );
    await expect(
      client.query(
        `
          insert into pending_questions (
            event_id,
            question_message_id,
            expected_field,
            event_version
          )
          values ($1, $2, 'title', 1)
        `,
        [event.id, secondQuestionMessageResult.rows[0].id],
      ),
    ).rejects.toMatchObject({
      code: "23505",
      constraint: "pending_questions_open_event_unique",
    });
    await client.query("rollback to savepoint before_second_open_question");

    await client.query("savepoint before_invalid_pending_version");
    await expect(
      client.query(
        `
          update pending_questions
          set event_version = 0
          where id = $1
        `,
        [pendingQuestion.id],
      ),
    ).rejects.toMatchObject({
      code: "23514",
      constraint: "pending_questions_event_version_positive_check",
    });
    await client.query("rollback to savepoint before_invalid_pending_version");

    await client.query("savepoint before_invalid_pending_resolution");
    await expect(
      client.query(
        `
          update pending_questions
          set status = 'RESOLVED'
          where id = $1
        `,
        [pendingQuestion.id],
      ),
    ).rejects.toMatchObject({
      code: "23514",
      constraint: "pending_questions_resolution_state_check",
    });
    await client.query("rollback to savepoint before_invalid_pending_resolution");

    const answerMessageResult = await client.query(
      `
        insert into chat_messages (case_id, role, kind, content)
        values ($1, 'USER', 'CLARIFICATION_ANSWER', 'At 10 AM')
        returning id
      `,
      [lifeCase.id],
    );

    await client.query(
      `
        update pending_questions
        set
          status = 'RESOLVED',
          resolved_by_message_id = $2,
          resolved_at = now()
        where id = $1
      `,
      [pendingQuestion.id, answerMessageResult.rows[0].id],
    );

    await client.query("savepoint before_duplicate_question_message");
    const secondAnswerMessageResult = await client.query(
      `
        insert into chat_messages (case_id, role, kind, content)
        values ($1, 'USER', 'CLARIFICATION_ANSWER', 'At 11 AM')
        returning id
      `,
      [lifeCase.id],
    );
    await expect(
      client.query(
        `
          insert into pending_questions (
            event_id,
            question_message_id,
            expected_field,
            status,
            event_version,
            resolved_by_message_id,
            resolved_at
          )
          values ($1, $2, 'startAt', 'RESOLVED', 1, $3, now())
        `,
        [event.id, questionMessage.id, secondAnswerMessageResult.rows[0].id],
      ),
    ).rejects.toMatchObject({
      code: "23505",
      constraint: "pending_questions_question_message_id_unique",
    });
    await client.query("rollback to savepoint before_duplicate_question_message");

    await client.query("savepoint before_duplicate_resolved_message");
    const thirdQuestionMessageResult = await client.query(
      `
        insert into chat_messages (case_id, role, kind, content)
        values ($1, 'ASSISTANT', 'CLARIFICATION_QUESTION', 'Third question')
        returning id
      `,
      [lifeCase.id],
    );
    await expect(
      client.query(
        `
          insert into pending_questions (
            event_id,
            question_message_id,
            expected_field,
            status,
            event_version,
            resolved_by_message_id,
            resolved_at
          )
          values ($1, $2, 'startAt', 'RESOLVED', 1, $3, now())
        `,
        [event.id, thirdQuestionMessageResult.rows[0].id, answerMessageResult.rows[0].id],
      ),
    ).rejects.toMatchObject({
      code: "23505",
      constraint: "pending_questions_resolved_by_message_id_unique",
    });
    await client.query("rollback to savepoint before_duplicate_resolved_message");

    await client.query("savepoint before_second_case_event");
    await expect(
      client.query(
        `
          insert into events (case_id)
          values ($1)
        `,
        [lifeCase.id],
      ),
    ).rejects.toMatchObject({
      code: "23505",
      constraint: "events_case_id_unique",
    });
    await client.query("rollback to savepoint before_second_case_event");

    await client.query("savepoint before_incomplete_ready_event");
    await expect(
      client.query(
        `
          update events
          set status = 'READY'
          where id = $1
        `,
        [event.id],
      ),
    ).rejects.toMatchObject({
      code: "23514",
      constraint: "events_ready_fields_check",
    });
    await client.query("rollback to savepoint before_incomplete_ready_event");

    await client.query("savepoint before_start_without_precision");
    await expect(
      client.query(
        `
          update events
          set start_at = '2026-08-01T17:00:00.000Z'
          where id = $1
        `,
        [event.id],
      ),
    ).rejects.toMatchObject({
      code: "23514",
      constraint: "events_start_at_precision_check",
    });
    await client.query("rollback to savepoint before_start_without_precision");

    for (const invalidUpdate of [
      {
        name: "blank title",
        sql: "update events set title = '   ' where id = $1",
        constraint: "events_title_not_blank_check",
      },
      {
        name: "blank time zone",
        sql: "update events set time_zone = '   ' where id = $1",
        constraint: "events_time_zone_not_blank_check",
      },
      {
        name: "blank location",
        sql: "update events set location = '   ' where id = $1",
        constraint: "events_location_not_blank_check",
      },
      {
        name: "non-positive version",
        sql: "update events set version = 0 where id = $1",
        constraint: "events_version_positive_check",
      },
      {
        name: "invalid time range",
        sql: `
          update events
          set
            start_at = '2026-08-01T17:00:00.000Z',
            start_at_precision = 'DATE_TIME',
            end_at = '2026-08-01T17:00:00.000Z',
            end_at_precision = 'DATE_TIME'
          where id = $1
        `,
        constraint: "events_time_range_check",
      },
    ]) {
      await client.query("savepoint before_invalid_event_value");
      await expect(client.query(invalidUpdate.sql, [event.id])).rejects.toMatchObject({
        code: "23514",
        constraint: invalidUpdate.constraint,
      });
      await client.query("rollback to savepoint before_invalid_event_value");
      await client.query("release savepoint before_invalid_event_value");
    }

    const [readyEvent] = await database
      .update(eventsTable)
      .set({
        status: "READY",
        title: "Do the laundry",
        startAt: new Date("2026-08-01T17:00:00.000Z"),
        startAtPrecision: "DATE_TIME",
        endAt: new Date("2026-08-01T18:00:00.000Z"),
        endAtPrecision: "DATE_TIME",
        timeZone: "Europe/Stockholm",
        location: "Laundry room",
      })
      .where(eq(eventsTable.id, event.id))
      .returning();

    expect(readyEvent).toMatchObject({
      status: "READY",
      title: "Do the laundry",
      timeZone: "Europe/Stockholm",
      location: "Laundry room",
    });
    expect(readyEvent?.updatedAt.getTime()).toBeGreaterThan(event.updated_at.getTime());

    const messageResult = await client.query(
      `
        insert into chat_messages (
          case_id,
          role,
          kind,
          content,
          client_message_id
        )
        values ($1, 'USER', 'USER_TEXT', $2, $3)
        returning case_id, content
      `,
      [lifeCase.id, "Remind me to book the laundry room next Tuesday.", clientMessageId],
    );

    expect(messageResult.rows[0].case_id).toBe(lifeCase.id);

    await client.query("savepoint before_invalid_foreign_key");
    await expect(
      client.query(
        `
          insert into chat_messages (case_id, role, kind, content)
          values ($1, 'USER', 'USER_TEXT', 'This case does not exist.')
        `,
        [randomUUID()],
      ),
    ).rejects.toMatchObject({
      code: "23503",
    });
    await client.query("rollback to savepoint before_invalid_foreign_key");

    await client.query("savepoint before_blank_content");
    await expect(
      client.query(
        `
          insert into chat_messages (case_id, role, kind, content)
          values ($1, 'USER', 'USER_TEXT', '   ')
        `,
        [lifeCase.id],
      ),
    ).rejects.toMatchObject({
      code: "23514",
    });
    await client.query("rollback to savepoint before_blank_content");

    await client.query("savepoint before_invalid_case_state");
    await expect(
      client.query(`
        insert into life_cases (status)
        values ('CLOSED')
      `),
    ).rejects.toMatchObject({
      code: "23514",
    });
    await client.query("rollback to savepoint before_invalid_case_state");

    await client.query("rollback");

    const persistedMessage = await client.query(
      `
        select id
        from chat_messages
        where client_message_id = $1
      `,
      [clientMessageId],
    );

    expect(persistedMessage.rowCount).toBe(0);
  } finally {
    await client.end();
  }
});
