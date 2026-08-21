import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { getDatabaseUrl } from "../config/environment";
import * as schema from "./schemas";

export type DatabaseClient = NodePgDatabase<typeof schema>;

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private pool: Pool | undefined;

  readonly db: DatabaseClient;

  constructor() {
    this.pool = new Pool({
      connectionString: getDatabaseUrl(),
    });

    this.db = drizzle({
      client: this.pool,
      schema,
    });
  }

  async ping(): Promise<void> {
    await this.db.execute("SELECT 1");
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }
}
