import { randomUUID } from "node:crypto";
import type { SystemConfig } from "../../core/entities/config.entity";
import type { Producto } from "../../core/entities/producto.entity";
import type { DetallePago, Venta, VentaItem } from "../../core/entities/venta.entity";
import { fromCents, toCents } from "../../core/utils/currency";
import { getTursoClient, withTursoTransaction } from "../../infrastructure/database/turso";

export type { DetallePago } from "../../core/entities/venta.entity";

type SqlExecutor = {
  execute: (statement: string | { sql: string; args?: Array<string | number | null> }) => Promise<any>;
};

export class SalesService {
  private readonly client = getTursoClient();
  private readonly tasaCambioFallback?: number;
  private readonly schemaReady: Promise<void>;
  private schemaEnsured = false;

  constructor(config?: SystemConfig) {
    this.schemaReady = this.ensureVentasSchema();

    if (config?.tasaCambio && config.tasaCambio > 0) {
      this.tasaCambioFallback = config.tasaCambio;
      void this.ensureDefaultExchangeRate(config.tasaCambio);
    }
  }

  public async obtenerHistorial(desde?: Date, hasta?: Date): Promise<Venta[]> {
    await this.schemaReady;
    const condiciones: string[] = [];
    const args: Array<string> = [];

    if (desde) {
      condiciones.push("fecha >= ?");
      args.push(desde.toISOString());
    }
    if (hasta) {
      condiciones.push("fecha <= ?");
      args.push(hasta.toISOString());
    }

    const whereClause = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
    const { rows } = await this.client.execute({
      sql: `SELECT id, total_nio, fecha, items, pagos, usuario_id, estado
            FROM ventas
            ${whereClause}
            ORDER BY fecha DESC`,
      args
    });

    return await this.hydrateVentas(rows, this.client);
  }

  public obtenerVentaPorId(id: string): Promise<Venta> {
    return this.fetchVentaById(id);
  }

  public async anularVenta(id: string): Promise<Venta> {
    await this.schemaReady;
    return await withTursoTransaction(async (tx) => {
      const venta = await this.fetchVentaById(id, tx);

      if (venta.items.length) {
        const productos = await this.fetchProductosByIds(
          venta.items.map((item) => item.productoId),
          tx
        );

        for (const item of venta.items) {
          const producto = productos.get(item.productoId);
          if (!producto) {
            throw new Error(`Producto ${item.productoId} no existe en inventario.`);
          }

          const nuevoStock = producto.stockDisponible + item.cantidad;
          await tx.execute({
            sql: "UPDATE productos SET stock_disponible = ? WHERE id = ?",
            args: [nuevoStock, producto.id]
          });
          producto.stockDisponible = nuevoStock;
        }
      }

      await tx.execute({
        sql: "DELETE FROM ventas WHERE id = ?",
        args: [id]
      });

      return venta;
    }, this.client);
  }

  public async procesarVenta(
    items: { productoId: string; cantidad: number }[],
    pagos: DetallePago[],
    usuarioId: string
  ): Promise<{ venta: Venta; cambio: number }> {
    await this.schemaReady;
    if (!items.length) {
      throw new Error("Debe incluir al menos un producto en la venta.");
    }
    if (!pagos.length) {
      throw new Error("Debe registrar al menos un pago.");
    }
    if (!usuarioId?.trim()) {
      throw new Error("Usuario autenticado requerido para registrar la venta.");
    }

    const tasaCambioBase = await this.obtenerTasaCambio();

    return await withTursoTransaction(async (tx) => {
      const pagosNormalizados = pagos.map((pago) => {
        const moneda = pago.moneda.trim().toUpperCase();
        if (moneda === "USD") {
          const tasa = pago.tasa ?? tasaCambioBase;
          if (tasa <= 0) {
            throw new Error("La tasa de cambio debe ser mayor a cero.");
          }
          return { ...pago, moneda, tasa };
        }
        return { ...pago, moneda, tasa: undefined };
      });

      const detalles = await Promise.all(
        items.map(async (item) => {
          if (item.cantidad <= 0) {
            throw new Error("La cantidad vendida debe ser mayor a cero.");
          }

          const producto = await this.fetchProductoById(item.productoId, tx);
          if (producto.stockDisponible < item.cantidad) {
            throw new Error(`Stock insuficiente para el producto ${producto.nombre}.`);
          }

          const precioUnitario = producto.precioVenta ?? producto.precioUnitario;
          if (precioUnitario === undefined) {
            throw new Error(`El producto ${producto.nombre} no tiene precio definido.`);
          }

          const precioUnitarioCents = toCents(precioUnitario);
          const subtotalCents = Math.round(precioUnitarioCents * item.cantidad);
          return {
            producto,
            cantidad: item.cantidad,
            precioUnitario: fromCents(precioUnitarioCents),
            precioUnitarioCents,
            subtotalCents
          };
        })
      );

      const totalVentaCents = detalles.reduce((acc, detalle) => acc + detalle.subtotalCents, 0);
      const totalPagadoCents = pagosNormalizados.reduce(
        (acc, pago) => acc + this.convertirPagoACents(pago, tasaCambioBase),
        0
      );

      if (totalPagadoCents < totalVentaCents) {
        throw new Error("Pagos insuficientes para cubrir el total de la venta.");
      }

      for (const { producto, cantidad } of detalles) {
        const nuevoStock = producto.stockDisponible - cantidad;
        await tx.execute({
          sql: "UPDATE productos SET stock_disponible = ? WHERE id = ?",
          args: [nuevoStock, producto.id]
        });
        producto.stockDisponible = nuevoStock;
      }

      const ventaItems: VentaItem[] = detalles.map((detalle) => ({
        productoId: detalle.producto.id,
        cantidad: detalle.cantidad,
        precioUnitario: detalle.precioUnitario
      }));

      const ventaId = randomUUID();
      const fechaVenta = new Date().toISOString();
      const totalVenta = fromCents(totalVentaCents);
      const venta: Venta = {
        id: ventaId,
        totalNIO: totalVenta,
        pagos: pagosNormalizados,
        items: ventaItems,
        fecha: fechaVenta,
        usuarioId,
        estado: "COMPLETA"
      };

      await tx.execute({
        sql: `INSERT INTO ventas (id, total_nio, fecha, items, pagos, usuario_id, estado)
              VALUES (?, ?, ?, ?, ?, ?, ?)` ,
        args: [
          venta.id,
          totalVentaCents,
          fechaVenta,
          JSON.stringify(venta.items),
          JSON.stringify(venta.pagos),
          usuarioId,
          venta.estado ?? "COMPLETA"
        ]
      });

      for (const detalle of detalles) {
        await tx.execute({
          sql: `INSERT INTO venta_items
                (id, venta_id, producto_id, cantidad, precio_unitario_cents, subtotal_cents)
                VALUES (?, ?, ?, ?, ?, ?)` ,
          args: [
            randomUUID(),
            venta.id,
            detalle.producto.id,
            detalle.cantidad,
            detalle.precioUnitarioCents,
            detalle.subtotalCents
          ]
        });
      }

      for (const pago of pagosNormalizados) {
        await tx.execute({
          sql: `INSERT INTO venta_pagos (id, venta_id, moneda, cantidad_cents, tasa)
                VALUES (?, ?, ?, ?, ?)` ,
          args: [randomUUID(), venta.id, pago.moneda, toCents(pago.cantidad), pago.tasa ?? null]
        });
      }

      const cambioCents = totalPagadoCents - totalVentaCents;
      const cambio = fromCents(cambioCents);
      return { venta, cambio };
    }, this.client);
  }

  private async obtenerTasaCambio(): Promise<number> {
    await this.schemaReady;
    const { rows } = await this.client.execute({
      sql: "SELECT value FROM config WHERE key = ?",
      args: ["tasaCambio"]
    });

    if (rows.length) {
      const value = Number(rows[0].value);
      if (Number.isFinite(value) && value > 0) {
        return value;
      }
    }

    if (this.tasaCambioFallback && this.tasaCambioFallback > 0) {
      return this.tasaCambioFallback;
    }

    return 1;
  }

  private async ensureDefaultExchangeRate(tasaCambio: number): Promise<void> {
    await this.client.execute({
      sql: `INSERT INTO config (key, value)
            VALUES ('tasaCambio', ?)
            ON CONFLICT(key) DO NOTHING`,
      args: [String(tasaCambio)]
    });
  }

  private async fetchVentaById(id: string, executor: SqlExecutor = this.client): Promise<Venta> {
    await this.schemaReady;
    const { rows } = await executor.execute({
      sql: `SELECT id, total_nio, fecha, items, pagos, usuario_id, estado
            FROM ventas
            WHERE id = ?`,
      args: [id]
    });

    if (!rows.length) {
      throw new Error("Venta no encontrada.");
    }

    const [venta] = await this.hydrateVentas(rows, executor);
    if (!venta) {
      throw new Error("Venta no encontrada.");
    }
    return venta;
  }

  private async hydrateVentas(
    rows: Record<string, unknown>[],
    executor: SqlExecutor
  ): Promise<Venta[]> {
    if (!rows.length) {
      return [];
    }

    const ids = rows.map((row) => String(row.id));
    const [itemsMap, pagosMap] = await Promise.all([
      this.fetchVentaItems(ids, executor),
      this.fetchVentaPagos(ids, executor)
    ]);

    return rows.map((row) => {
      const ventaId = String(row.id);
      return this.mapVentaRow(row, itemsMap.get(ventaId), pagosMap.get(ventaId));
    });
  }

  private async fetchVentaItems(ids: string[], executor: SqlExecutor): Promise<Map<string, VentaItem[]>> {
    await this.schemaReady;
    const map = new Map<string, VentaItem[]>();
    if (!ids.length) {
      return map;
    }

    const placeholders = ids.map(() => "?").join(",");
    const { rows } = await executor.execute({
      sql: `SELECT venta_id, producto_id, cantidad, precio_unitario_cents
            FROM venta_items
            WHERE venta_id IN (${placeholders})`,
      args: ids
    });

    rows.forEach((row: Record<string, unknown>) => {
      const ventaId = String(row.venta_id);
      const item: VentaItem = {
        productoId: String(row.producto_id),
        cantidad: Number(row.cantidad ?? 0),
        precioUnitario: fromCents(Number(row.precio_unitario_cents ?? 0))
      };

      const current = map.get(ventaId) ?? [];
      current.push(item);
      map.set(ventaId, current);
    });

    return map;
  }

  private async fetchVentaPagos(ids: string[], executor: SqlExecutor): Promise<Map<string, DetallePago[]>> {
    await this.schemaReady;
    const map = new Map<string, DetallePago[]>();
    if (!ids.length) {
      return map;
    }

    const placeholders = ids.map(() => "?").join(",");
    const { rows } = await executor.execute({
      sql: `SELECT venta_id, moneda, cantidad_cents, tasa
            FROM venta_pagos
            WHERE venta_id IN (${placeholders})`,
      args: ids
    });

    rows.forEach((row: Record<string, unknown>) => {
      const ventaId = String(row.venta_id);
      const pago: DetallePago = {
        moneda: String(row.moneda ?? "NIO"),
        cantidad: fromCents(Number(row.cantidad_cents ?? 0)),
        tasa:
          row.tasa !== null && row.tasa !== undefined
            ? Number(row.tasa)
            : undefined
      };

      const current = map.get(ventaId) ?? [];
      current.push(pago);
      map.set(ventaId, current);
    });

    return map;
  }

  private async fetchProductoById(id: string, executor: SqlExecutor = this.client): Promise<Producto> {
    await this.schemaReady;
    const { rows } = await executor.execute({
      sql: "SELECT id, nombre, stock_disponible, precio_unitario, precio_venta FROM productos WHERE id = ?",
      args: [id]
    });

    if (!rows.length) {
      throw new Error(`Producto ${id} no encontrado.`);
    }

    const row = rows[0];
    return {
      id: String(row.id),
      nombre: String(row.nombre),
      stockDisponible: Number(row.stock_disponible ?? 0),
      precioUnitario:
        row.precio_unitario !== null && row.precio_unitario !== undefined
          ? Number(row.precio_unitario)
          : undefined,
      precioVenta:
        row.precio_venta !== null && row.precio_venta !== undefined
          ? Number(row.precio_venta)
          : undefined
    };
  }

  private async fetchProductosByIds(ids: string[], executor: SqlExecutor): Promise<Map<string, Producto>> {
    await this.schemaReady;
    const map = new Map<string, Producto>();
    if (!ids.length) {
      return map;
    }

    const placeholders = ids.map(() => "?").join(",");
    const { rows } = await executor.execute({
      sql: `SELECT id, nombre, stock_disponible, precio_unitario, precio_venta
            FROM productos
            WHERE id IN (${placeholders})`,
      args: ids
    });

    rows.forEach((row: Record<string, unknown>) => {
      const producto: Producto = {
        id: String(row.id),
        nombre: String(row.nombre),
        stockDisponible: Number(row.stock_disponible ?? 0),
        precioUnitario:
          row.precio_unitario !== null && row.precio_unitario !== undefined
            ? Number(row.precio_unitario)
            : undefined,
        precioVenta:
          row.precio_venta !== null && row.precio_venta !== undefined
            ? Number(row.precio_venta)
            : undefined
      };
      map.set(producto.id, producto);
    });

    return map;
  }

  private mapVentaRow(
    row: Record<string, unknown>,
    normalizedItems?: VentaItem[],
    normalizedPagos?: DetallePago[]
  ): Venta {
    const totalCents = Number(row.total_nio ?? 0);
    const fallbackItems = this.parseJsonField<VentaItem[]>(row.items) ?? [];
    const fallbackPagos = this.parseJsonField<DetallePago[]>(row.pagos) ?? [];
    const items = normalizedItems && normalizedItems.length ? normalizedItems : fallbackItems;
    const pagos = normalizedPagos && normalizedPagos.length ? normalizedPagos : fallbackPagos;

    return {
      id: String(row.id),
      totalNIO: fromCents(totalCents),
      fecha: typeof row.fecha === "string" ? row.fecha : undefined,
      items: items.map((item) => ({ ...item })),
      pagos: pagos.map((pago) => ({ ...pago })),
      usuarioId: typeof row.usuario_id === "string" ? row.usuario_id : undefined,
      estado: typeof row.estado === "string" ? row.estado : undefined
    };
  }

  private parseJsonField<T>(value: unknown): T | undefined {
    if (typeof value !== "string" || !value.trim()) {
      return undefined;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return undefined;
    }
  }

  private convertirPagoACents(pago: DetallePago, tasaCambioBase: number): number {
    if (pago.cantidad <= 0) {
      throw new Error("Los pagos deben tener montos positivos.");
    }

    const moneda = pago.moneda.trim().toUpperCase();
    if (moneda === "USD") {
      const tasa = pago.tasa ?? tasaCambioBase;
      if (tasa <= 0) {
        throw new Error("La tasa de cambio debe ser mayor a cero.");
      }
      return Math.round(pago.cantidad * tasa * 100);
    }

    return toCents(pago.cantidad);
  }

  private async ensureVentasSchema(): Promise<void> {
    if (this.schemaEnsured) {
      return;
    }

    const columnResult = await this.client.execute("PRAGMA table_info(ventas)");
    const columnNames = new Set<string>(
      columnResult.rows.map((row: Record<string, unknown>) => String(row.name))
    );

    const alterStatements: string[] = [];
    if (!columnNames.has("usuario_id")) {
      alterStatements.push("ALTER TABLE ventas ADD COLUMN usuario_id TEXT");
    }
    if (!columnNames.has("estado")) {
      alterStatements.push("ALTER TABLE ventas ADD COLUMN estado TEXT DEFAULT 'COMPLETA'");
    }

    for (const statement of alterStatements) {
      await this.client.execute(statement);
    }

    await this.client.execute(`CREATE TABLE IF NOT EXISTS venta_items (
      id TEXT PRIMARY KEY,
      venta_id TEXT NOT NULL,
      producto_id TEXT NOT NULL,
      cantidad INTEGER NOT NULL,
      precio_unitario_cents INTEGER NOT NULL,
      subtotal_cents INTEGER NOT NULL,
      FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
      FOREIGN KEY (producto_id) REFERENCES productos(id)
    )`);

    await this.client.execute(`CREATE TABLE IF NOT EXISTS venta_pagos (
      id TEXT PRIMARY KEY,
      venta_id TEXT NOT NULL,
      moneda TEXT NOT NULL,
      cantidad_cents INTEGER NOT NULL,
      tasa REAL,
      FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE
    )`);

    await this.client.execute(`CREATE TABLE IF NOT EXISTS receta_items (
      id TEXT PRIMARY KEY,
      receta_id TEXT NOT NULL,
      insumo_id TEXT NOT NULL,
      cantidad REAL NOT NULL,
      FOREIGN KEY (receta_id) REFERENCES recetas(id) ON DELETE CASCADE,
      FOREIGN KEY (insumo_id) REFERENCES insumos(id)
    )`);

    await this.client.execute("CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha)");
    await this.client.execute("CREATE INDEX IF NOT EXISTS idx_recetas_producto ON recetas(producto_id)");
    await this.client.execute("CREATE INDEX IF NOT EXISTS idx_insumos_nombre ON insumos(nombre)");
    await this.client.execute("CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos(nombre)");
    await this.client.execute(
      "CREATE INDEX IF NOT EXISTS idx_venta_items_producto ON venta_items(producto_id)"
    );

    this.schemaEnsured = true;
  }
}
