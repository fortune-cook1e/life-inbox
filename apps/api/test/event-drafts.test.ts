import { describe, expect, it } from "vitest";
import { useTestDatabaseTransaction } from "./support/database-test-transaction";

describe("event_drafts database invariants", () => {
  const database = useTestDatabaseTransaction();

  it("allows at most one event draft for each source message", async () => {
    const client = database.getClient();

    const messageResult = await client.query<{ id: string }>(
      `
        INSERT INTO messages (role, content)
        VALUES ('user', $1)
        RETURNING id
      `,
      ["Meet Anna on August 24 at 15:00."],
    );

    const sourceMessageId = messageResult.rows[0]?.id;

    if (sourceMessageId === undefined) {
      throw new Error("Message insert returned no row.");
    }

    await client.query(
      `
        INSERT INTO event_drafts (
          source_message_id,
          title,
          start_at,
          timezone
        )
        VALUES ($1, $2, $3, $4)
      `,
      [sourceMessageId, "Meet Anna", "2026-08-24 15:00:00", "Europe/Stockholm"],
    );

    const duplicateInsert = client.query(
      `
        INSERT INTO event_drafts (
          source_message_id,
          title,
          start_at,
          timezone
        )
        VALUES ($1, $2, $3, $4)
      `,
      [sourceMessageId, "Duplicate meeting", "2026-08-24 16:00:00", "Europe/Stockholm"],
    );

    await expect(duplicateInsert).rejects.toMatchObject({
      code: "23505",
      constraint: "event_drafts_source_message_id_unique",
    });
  });
});
