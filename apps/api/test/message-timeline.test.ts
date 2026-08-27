import { describe, expect, it } from "vitest";

import { useTestDatabaseTransaction } from "./support/database-test-transaction";

describe("messages timeline database invariants", () => {
  const database = useTestDatabaseTransaction();

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
});
