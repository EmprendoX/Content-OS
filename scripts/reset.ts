import fs from "node:fs";
import { createDb, resolveDatabasePath } from "@/lib/db/client";
import { seed } from "@/lib/db/seed";

/**
 * Borra la base de datos local y la regenera con datos de demostración.
 * Solo afecta a ./data/content-os.db (y sus archivos WAL). Nunca toca ./data/media.
 */
async function main() {
  const dbPath = resolveDatabasePath();
  if (dbPath === ":memory:") throw new Error("No tiene sentido resetear una base en memoria.");
  for (const suffix of ["", "-wal", "-shm"]) {
    const file = `${dbPath}${suffix}`;
    if (fs.existsSync(file)) fs.rmSync(file);
  }
  const db = createDb(dbPath);
  await seed(db);
  console.log(`Base de datos regenerada con datos de demostración: ${dbPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
