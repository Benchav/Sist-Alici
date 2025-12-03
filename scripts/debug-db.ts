import { getTursoClient } from "../src/infrastructure/database/turso";

async function main(): Promise<void> {
  const client = getTursoClient();
  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'rec%'"
  );
  console.log("tables", tables.rows);
  const fk = await client.execute("PRAGMA foreign_key_list(recetas);");
  console.log("fk", fk.rows);
}

void main();
