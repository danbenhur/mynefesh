import { mkdirSync } from "node:fs";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

/** PGlite does not create parent directories itself */
export function ensurePgliteDir(): string {
  mkdirSync("./.data", { recursive: true });
  return "./.data/pglite";
}

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * DATABASE_URL set  → real Postgres (production / staging).
 * DATABASE_URL unset → PGlite, an embedded Postgres that persists to
 * ./.data/pglite. Zero-setup local dev: no server to install or run.
 */
let _db: Db | undefined;

export async function getDb(): Promise<Db> {
  if (_db) return _db;

  if (process.env.DATABASE_URL) {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const postgres = (await import("postgres")).default;
    const client = postgres(process.env.DATABASE_URL, { max: 5 });
    _db = drizzle(client, { schema }) as unknown as Db;
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const client = new PGlite(ensurePgliteDir());
    _db = drizzle(client, { schema }) as unknown as Db;
  }
  return _db;
}
