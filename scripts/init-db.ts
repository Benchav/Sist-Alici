import "../src/config/env";

import { getTursoClient } from "../src/infrastructure/database/turso";

const ddlStatements = [
  `CREATE TABLE IF NOT EXISTS usuarios (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    rol TEXT NOT NULL,
    password_hash TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS insumos (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    unidad TEXT NOT NULL,
    stock REAL NOT NULL,
    costo_promedio REAL NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS productos (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    stock_disponible REAL NOT NULL,
    precio_unitario REAL,
    precio_venta REAL
  )`,
  `CREATE TABLE IF NOT EXISTS recetas (
    id TEXT PRIMARY KEY,
    producto_id TEXT NOT NULL,
    costo_mano_obra REAL,
    items TEXT NOT NULL,
    FOREIGN KEY (producto_id) REFERENCES productos(id)
  )`,
  `CREATE TABLE IF NOT EXISTS ventas (
    id TEXT PRIMARY KEY,
    total_nio REAL NOT NULL,
    fecha TEXT NOT NULL,
    items TEXT NOT NULL,
    pagos TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`
];

const seedStatements = [
  {
    sql: `INSERT INTO usuarios (id, username, nombre, rol, password_hash)
          VALUES ('USR-ADMIN-0001', 'admin', 'Juan Gerente', 'ADMIN', $1)
          ON CONFLICT(id) DO NOTHING`,
    args: ["$2b$10$tSPWEkXQUh6GezwAOprsiOzUFoWqfpwImqr218onD6cT9zJwTg7Eq"]
  },
  {
    sql: `INSERT INTO config (key, value)
          VALUES ('tasaCambio', '36.6')
          ON CONFLICT(key) DO NOTHING`,
    args: []
  }
];

async function main(): Promise<void> {
  const client = getTursoClient();

  try {
    for (const statement of ddlStatements) {
      await client.execute(statement);
    }

    for (const { sql, args } of seedStatements) {
      await client.execute({ sql, args });
    }

    console.log("Turso database initialized successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Error initializing Turso database:", error);
    process.exit(1);
  }
}

void main();
