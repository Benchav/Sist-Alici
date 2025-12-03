PRAGMA foreign_keys = ON;

-- Nuevas tablas maestras
CREATE TABLE IF NOT EXISTS categorias (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('PRODUCCION', 'REVENTA', 'INSUMO')),
  UNIQUE(nombre, tipo)
);

CREATE TABLE IF NOT EXISTS proveedores (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  frecuencia_credito TEXT,
  contacto TEXT
);

CREATE TABLE IF NOT EXISTS descartes (
  id TEXT PRIMARY KEY,
  producto_id TEXT NOT NULL,
  cantidad INTEGER NOT NULL,
  motivo TEXT,
  fecha TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (producto_id) REFERENCES productos(id)
);

-- Módulo de encargos / pedidos anticipados
CREATE TABLE IF NOT EXISTS encargos (
  id TEXT PRIMARY KEY,
  cliente TEXT NOT NULL,
  fecha_entrega TEXT NOT NULL,
  total_estimado_cents INTEGER NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'ENTREGADO', 'CANCELADO')),
  venta_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (venta_id) REFERENCES ventas(id)
);

CREATE TABLE IF NOT EXISTS encargo_abonos (
  id TEXT PRIMARY KEY,
  encargo_id TEXT NOT NULL,
  monto_cents INTEGER NOT NULL,
  fecha TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  medio_pago TEXT,
  FOREIGN KEY (encargo_id) REFERENCES encargos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS encargo_items (
  id TEXT PRIMARY KEY,
  encargo_id TEXT NOT NULL,
  producto_id TEXT NOT NULL,
  cantidad INTEGER NOT NULL,
  precio_estimado_cents INTEGER NOT NULL,
  FOREIGN KEY (encargo_id) REFERENCES encargos(id) ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id)
);

-- Alteraciones a tablas existentes
ALTER TABLE productos ADD COLUMN categoria_id TEXT REFERENCES categorias(id);
ALTER TABLE ventas ADD COLUMN descuento_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ventas ADD COLUMN tipo_venta TEXT NOT NULL DEFAULT 'DIRECTA' CHECK (tipo_venta IN ('DIRECTA', 'ENCARGO'));
ALTER TABLE insumos ADD COLUMN proveedor_principal_id TEXT REFERENCES proveedores(id);

CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_insumos_proveedor ON insumos(proveedor_principal_id);
CREATE INDEX IF NOT EXISTS idx_descartes_producto ON descartes(producto_id);
CREATE INDEX IF NOT EXISTS idx_encargos_estado ON encargos(estado);
CREATE INDEX IF NOT EXISTS idx_encargos_venta ON encargos(venta_id);
CREATE INDEX IF NOT EXISTS idx_encargo_abonos_encargo ON encargo_abonos(encargo_id);
CREATE INDEX IF NOT EXISTS idx_encargo_items_encargo ON encargo_items(encargo_id);
