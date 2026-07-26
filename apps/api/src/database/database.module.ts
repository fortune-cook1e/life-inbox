import { Module } from "@nestjs/common";

import { createDatabase } from "./client.js";
import { DATABASE_CONNECTION } from "./database.constants.js";
import { DatabaseService } from "./database.service.js";

@Module({
  providers: [
    {
      provide: DATABASE_CONNECTION,
      useFactory: createDatabase,
    },
    DatabaseService,
  ],
  exports: [DatabaseService],
})
export class DatabaseModule {}
