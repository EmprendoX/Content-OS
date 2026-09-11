import { createDb, resolveDatabasePath } from "@/lib/db/client";

const db = createDb();
void db;
console.log(`Migraciones aplicadas en ${resolveDatabasePath()}`);
