import "../src/config/env";

import { getTursoClient } from "../src/infrastructure/database/turso";

const ddlStatements = [
  `PRAGMA foreign_keys = ON`,
  `CREATE TABLE IF NOT EXISTS usuarios (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    rol TEXT NOT NULL,
    password_hash TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS categorias (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('PRODUCCION', 'REVENTA', 'INSUMO')),
    UNIQUE (nombre, tipo)
  )`,
  `CREATE TABLE IF NOT EXISTS proveedores (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    frecuencia_credito TEXT,
    contacto TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS insumos (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    unidad TEXT NOT NULL,
    stock REAL NOT NULL,
    costo_promedio REAL NOT NULL,
    proveedor_principal_id TEXT,
    FOREIGN KEY (proveedor_principal_id) REFERENCES proveedores(id)
  )`,
  `CREATE TABLE IF NOT EXISTS productos (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    stock_disponible REAL NOT NULL,
    precio_unitario REAL,
    precio_venta REAL,
    categoria_id TEXT,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id)
  )`,
  `CREATE TABLE IF NOT EXISTS recetas (
    id TEXT PRIMARY KEY,
    producto_id TEXT NOT NULL,
    costo_mano_obra REAL,
    items TEXT NOT NULL,
    rendimiento_base INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (producto_id) REFERENCES productos(id)
  )`,
  `CREATE TABLE IF NOT EXISTS descartes (
    id TEXT PRIMARY KEY,
    producto_id TEXT NOT NULL,
    cantidad INTEGER NOT NULL,
    motivo TEXT,
    fecha TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (producto_id) REFERENCES productos(id)
  )`,
  `CREATE TABLE IF NOT EXISTS ventas (
    id TEXT PRIMARY KEY,
    total_nio REAL NOT NULL,
    fecha TEXT NOT NULL,
    items TEXT NOT NULL,
    pagos TEXT NOT NULL,
    usuario_id TEXT,
    estado TEXT DEFAULT 'COMPLETA',
    descuento_cents INTEGER NOT NULL DEFAULT 0,
    tipo_venta TEXT NOT NULL DEFAULT 'DIRECTA' CHECK (tipo_venta IN ('DIRECTA','ENCARGO'))
  )`,
  `CREATE TABLE IF NOT EXISTS venta_items (
    id TEXT PRIMARY KEY,
    venta_id TEXT NOT NULL,
    producto_id TEXT NOT NULL,
    cantidad INTEGER NOT NULL,
    precio_unitario_cents INTEGER NOT NULL,
    subtotal_cents INTEGER NOT NULL,
    FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id)
  )`,
  `CREATE TABLE IF NOT EXISTS venta_pagos (
    id TEXT PRIMARY KEY,
    venta_id TEXT NOT NULL,
    moneda TEXT NOT NULL,
    cantidad_cents INTEGER NOT NULL,
    tasa REAL,
    FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS receta_items (
    id TEXT PRIMARY KEY,
    receta_id TEXT NOT NULL,
    insumo_id TEXT NOT NULL,
    cantidad REAL NOT NULL,
    FOREIGN KEY (receta_id) REFERENCES recetas(id) ON DELETE CASCADE,
    FOREIGN KEY (insumo_id) REFERENCES insumos(id)
  )`,
  `CREATE TABLE IF NOT EXISTS encargos (
    id TEXT PRIMARY KEY,
    cliente TEXT NOT NULL,
    fecha_entrega TEXT NOT NULL,
    total_estimado_cents INTEGER NOT NULL DEFAULT 0,
    estado TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','ENTREGADO','CANCELADO')),
    venta_id TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (venta_id) REFERENCES ventas(id)
  )`,
  `CREATE TABLE IF NOT EXISTS encargo_items (
    id TEXT PRIMARY KEY,
    encargo_id TEXT NOT NULL,
    producto_id TEXT NOT NULL,
    cantidad INTEGER NOT NULL,
    precio_estimado_cents INTEGER NOT NULL,
    FOREIGN KEY (encargo_id) REFERENCES encargos(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id)
  )`,
  `CREATE TABLE IF NOT EXISTS encargo_abonos (
    id TEXT PRIMARY KEY,
    encargo_id TEXT NOT NULL,
    monto_cents INTEGER NOT NULL,
    fecha TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    medio_pago TEXT,
    FOREIGN KEY (encargo_id) REFERENCES encargos(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha)`,
  `CREATE INDEX IF NOT EXISTS idx_recetas_producto ON recetas(producto_id)`,
  `CREATE INDEX IF NOT EXISTS idx_insumos_nombre ON insumos(nombre)`,
  `CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos(nombre)`,
  `CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id)`,
  `CREATE INDEX IF NOT EXISTS idx_insumos_proveedor ON insumos(proveedor_principal_id)`,
  `CREATE INDEX IF NOT EXISTS idx_descartes_producto ON descartes(producto_id)`,
  `CREATE INDEX IF NOT EXISTS idx_encargos_estado ON encargos(estado)`,
  `CREATE INDEX IF NOT EXISTS idx_encargos_venta ON encargos(venta_id)`,
  `CREATE INDEX IF NOT EXISTS idx_encargo_abonos_encargo ON encargo_abonos(encargo_id)`,
  `CREATE INDEX IF NOT EXISTS idx_encargo_items_encargo ON encargo_items(encargo_id)`,
  `CREATE INDEX IF NOT EXISTS idx_venta_items_producto ON venta_items(producto_id)`
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
