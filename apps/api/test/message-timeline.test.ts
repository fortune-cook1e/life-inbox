import { describe, expect, it } from "vitest";

import { useTestDatabaseTransaction } from "./support/database-test-transaction";

interface StoredTimelineMessage {
  kind: "text" | "event_card";
  content: string | null;
  payload: unknown;
}

describe("messages timeline database invariants", () => {
  const database = useTestDatabaseTransaction();

  it("stores an Event Card as an assistant timeline snapshot", async () => {
    const client = database.getClient();

    const payload = {
      draftId: "e18f2dc1-58b8-460d-aac8-7c906f5668f5",
      title: "Meet Anna",
      startAt: "2026-08-26T15:00:00",
      endAt: null,
      timezone: "Europe/Stockholm",
      location: null,
      description: null,
    };

    const result = await client.query<StoredTimelineMessage>(
      `
        INSERT INTO messages (
          role,
          kind,
          content,
          payload
        )
        VALUES ('assistant', 'event_card', NULL, $1::jsonb)
        RETURNING kind, content, payload
      `,
      [JSON.stringify(payload)],
    );

    expect(result.rows[0]).toEqual({
      kind: "event_card",
      content: null,
      payload,
    });
  });

  it("rejects an Event Card without a payload", async () => {
    const client = database.getClient();

    const invalidInsert = client.query(
      `
        INSERT INTO messages (
          role,
          kind,
          content,
          payload
        )
        VALUES ('assistant', 'event_card', NULL, NULL)
      `,
    );

    await expect(invalidInsert).rejects.toMatchObject({
      code: "23514",
      constraint: "messages_content_payload_shape_check",
    });
  });

  it("keeps existing text inserts compatible through database defaults", async () => {
    const client = database.getClient();

    const result = await client.query<StoredTimelineMessage>(
      `
        INSERT INTO messages (
          role,
          content
        )
        VALUES ('user', $1)
        RETURNING kind, content, payload
      `,
      ["Hello"],
    );

    expect(result.rows[0]).toEqual({
      kind: "text",
      content: "Hello",
      payload: null,
    });
  });
});
