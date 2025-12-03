PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS venta_items_new;
CREATE TABLE IF NOT EXISTS venta_items_new (
  id TEXT PRIMARY KEY,
  venta_id TEXT NOT NULL,
  producto_id TEXT,
  cantidad INTEGER NOT NULL,
  precio_unitario_cents INTEGER NOT NULL,
  subtotal_cents INTEGER NOT NULL,
  FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE SET NULL
);
INSERT INTO venta_items_new (id, venta_id, producto_id, cantidad, precio_unitario_cents, subtotal_cents)
SELECT id, venta_id, producto_id, cantidad, precio_unitario_cents, subtotal_cents
FROM venta_items;
DROP TABLE venta_items;
ALTER TABLE venta_items_new RENAME TO venta_items;

DROP TABLE IF EXISTS encargo_items_new;
CREATE TABLE IF NOT EXISTS encargo_items_new (
  id TEXT PRIMARY KEY,
  encargo_id TEXT NOT NULL,
  producto_id TEXT,
  cantidad INTEGER NOT NULL,
  precio_estimado_cents INTEGER NOT NULL,
  FOREIGN KEY (encargo_id) REFERENCES encargos(id) ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE SET NULL
);
INSERT INTO encargo_items_new (id, encargo_id, producto_id, cantidad, precio_estimado_cents)
SELECT id, encargo_id, producto_id, cantidad, precio_estimado_cents
FROM encargo_items;
DROP TABLE encargo_items;
ALTER TABLE encargo_items_new RENAME TO encargo_items;

DROP TABLE IF EXISTS descartes_new;
CREATE TABLE IF NOT EXISTS descartes_new (
  id TEXT PRIMARY KEY,
  producto_id TEXT NOT NULL,
  cantidad INTEGER NOT NULL,
  motivo TEXT,
  fecha TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
);
INSERT INTO descartes_new (id, producto_id, cantidad, motivo, fecha)
SELECT id, producto_id, cantidad, motivo, fecha FROM descartes;
DROP TABLE descartes;
ALTER TABLE descartes_new RENAME TO descartes;

PRAGMA foreign_keys = ON;

CREATE INDEX IF NOT EXISTS idx_venta_items_producto ON venta_items(producto_id);
CREATE INDEX IF NOT EXISTS idx_encargo_items_encargo ON encargo_items(encargo_id);
CREATE INDEX IF NOT EXISTS idx_descartes_producto ON descartes(producto_id);
