import { randomUUID } from "node:crypto";
import process from "node:process";

import { Client } from "pg";
import { expect, it } from "vitest";

it("enforces the first LifeCase and ChatMessage invariants", async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  const clientMessageId = `schema-test-${randomUUID()}`;

  await client.connect();

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
