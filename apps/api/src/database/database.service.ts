import { Inject, Injectable, OnApplicationShutdown } from "@nestjs/common";
import { sql } from "drizzle-orm";

import type { DatabaseConnection } from "./client.js";
import { DATABASE_CONNECTION } from "./database.constants.js";

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly connection: DatabaseConnection,
  ) {}

  get db() {
    return this.connection.db;
  }

  async ping() {
    await this.connection.db.execute(sql`select 1 as ok`);
  }

  async onApplicationShutdown() {
    await this.connection.pool.end();
  }
}
