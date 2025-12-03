const { createClient } = require("@libsql/client");

async function main() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });
  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'rec%'"
  );
  console.log("tables", tables.rows);
  const fk = await client.execute("PRAGMA foreign_key_list(recetas);");
  console.log("fk", fk.rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
