#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");
const process = require("node:process");
const { createClient } = require("@libsql/client");
require("dotenv").config({ path: path.resolve(process.cwd(), ".env") });

const migrationsDir = path.resolve(__dirname, "../migrations");

const ensureConfig = () => {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error("TURSO_DATABASE_URL is required to run migrations.");
  }
  if (!authToken) {
    throw new Error("TURSO_AUTH_TOKEN is required to run migrations.");
  }

  return { url, authToken };
};

const readMigrations = () => {
  if (!fs.existsSync(migrationsDir)) {
    throw new Error("No migrations directory found.");
  }

  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));
};

const run = async () => {
  const config = ensureConfig();
  const client = createClient(config);
  const files = readMigrations();

  if (!files.length) {
    console.log("No migrations to run.");
    return;
  }

  await client.execute("PRAGMA foreign_keys = ON;");

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, "utf-8");
    if (!sql.trim()) {
      continue;
    }

    console.log(`\n>>> Running migration ${file}`);
    const statements = sql
      .split(/;\s*(?:\r?\n|$)/)
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await client.execute(statement);
    }
    console.log(`<<< Completed ${file}`);
  }
};

run()
  .then(() => {
    console.log("\nAll migrations applied successfully.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nMigration failed:", error);
    process.exit(1);
  });
