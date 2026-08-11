import { Injectable, NotFoundException } from "@nestjs/common";
import { eq, inArray } from "drizzle-orm";

import { DatabaseService } from "../database/database.service.js";
import { chatMessages, events, lifeCases, pendingQuestions } from "../database/schema.js";

@Injectable()
export class CasesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async deleteCase(caseId: string) {
    await this.databaseService.db.transaction(async (transaction) => {
      const [lifeCase] = await transaction
        .select({ id: lifeCases.id })
        .from(lifeCases)
        .where(eq(lifeCases.id, caseId))
        .for("update")
        .limit(1);

      if (!lifeCase) {
        throw new NotFoundException(`Case ${caseId} was not found.`);
      }

      const caseEvents = await transaction
        .select({ id: events.id })
        .from(events)
        .where(eq(events.caseId, caseId));

      if (caseEvents.length > 0) {
        await transaction.delete(pendingQuestions).where(
          inArray(
            pendingQuestions.eventId,
            caseEvents.map((event) => event.id),
          ),
        );
      }

      await transaction.delete(chatMessages).where(eq(chatMessages.caseId, caseId));
      await transaction.delete(events).where(eq(events.caseId, caseId));

      const [deletedCase] = await transaction
        .delete(lifeCases)
        .where(eq(lifeCases.id, caseId))
        .returning({ id: lifeCases.id });

      if (!deletedCase) {
        throw new Error(`Deleting Case ${caseId} did not return a row.`);
      }
    });
  }
}
