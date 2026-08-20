import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// The database connection string is optional at boot. We create the pool
// lazily so the API server can still start and serve public endpoints
// (e.g. /api/discord/status) even when DATABASE_URL is not yet provisioned
// (platform attach, local dev without Postgres). A missing URL only surfaces
// as a connection error on the first real query — it never crashes startup.
const connectionString = process.env.DATABASE_URL;

export const pool = new Pool(
  connectionString ? { connectionString } : { host: "localhost", port: 5432 },
);

export const db = drizzle(pool, { schema });

export * from "./schema";
