PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS venta_items (
  id TEXT PRIMARY KEY,
  venta_id TEXT NOT NULL,
  producto_id TEXT NOT NULL,
  cantidad INTEGER NOT NULL,
  precio_unitario_cents INTEGER NOT NULL,
  subtotal_cents INTEGER NOT NULL,
  FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id)
);

CREATE TABLE IF NOT EXISTS venta_pagos (
  id TEXT PRIMARY KEY,
  venta_id TEXT NOT NULL,
  moneda TEXT NOT NULL,
  cantidad_cents INTEGER NOT NULL,
  tasa REAL,
  FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS receta_items (
  id TEXT PRIMARY KEY,
  receta_id TEXT NOT NULL,
  insumo_id TEXT NOT NULL,
  cantidad REAL NOT NULL,
  FOREIGN KEY (receta_id) REFERENCES recetas(id) ON DELETE CASCADE,
  FOREIGN KEY (insumo_id) REFERENCES insumos(id)
);

ALTER TABLE ventas ADD COLUMN usuario_id TEXT;
ALTER TABLE ventas ADD COLUMN estado TEXT DEFAULT 'COMPLETA';

CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha);
CREATE INDEX IF NOT EXISTS idx_insumos_nombre ON insumos(nombre);
CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos(nombre);
CREATE INDEX IF NOT EXISTS idx_venta_items_producto ON venta_items(producto_id);
