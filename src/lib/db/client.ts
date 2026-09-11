import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

export function resolveDatabasePath(): string {
  const configured = process.env.DATABASE_PATH ?? "./data/content-os.db";
  if (configured === ":memory:") return configured;
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), configured);
}

/**
 * Crea una conexión a SQLite y aplica las migraciones pendientes.
 * Usar ":memory:" para tests.
 */
export function createDb(dbPath: string = resolveDatabasePath()): Db {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}

declare global {
  var __contentOsDb: Db | undefined;
}

/** Conexión única por proceso (sobrevive al hot reload de Next.js). */
export function getDb(): Db {
  if (!globalThis.__contentOsDb) {
    globalThis.__contentOsDb = createDb();
  }
  return globalThis.__contentOsDb;
}

export { schema };
