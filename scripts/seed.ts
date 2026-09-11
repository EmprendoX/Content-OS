import { createDb, resolveDatabasePath } from "@/lib/db/client";
import { isSeeded, seed } from "@/lib/db/seed";

async function main() {
  const db = createDb();
  if (isSeeded(db)) {
    console.log("La base de datos ya tiene datos. Usa `npm run db:reset` para regenerar la demo.");
    return;
  }
  await seed(db);
  console.log(`Datos de demostración creados en ${resolveDatabasePath()}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
