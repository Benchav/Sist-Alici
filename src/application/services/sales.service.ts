import { randomUUID } from "node:crypto";
import type { SystemConfig } from "../../core/entities/config.entity";
import type { Producto } from "../../core/entities/producto.entity";
import type { DetallePago, Venta, VentaItem } from "../../core/entities/venta.entity";
import { centsToAmount, toCents } from "../../core/utils/currency";
import { getTursoClient, withTursoTransaction } from "../../infrastructure/database/turso";

export type { DetallePago } from "../../core/entities/venta.entity";

type SqlExecutor = {
  execute: (statement: string | { sql: string; args?: Array<string | number | null> }) => Promise<any>;
};

export class SalesService {
  private readonly client = getTursoClient();
  private readonly tasaCambioFallback?: number;

  constructor(config?: SystemConfig) {
    if (config?.tasaCambio && config.tasaCambio > 0) {
      this.tasaCambioFallback = config.tasaCambio;
      void this.ensureDefaultExchangeRate(config.tasaCambio);
    }
  }

  public async obtenerHistorial(desde?: Date, hasta?: Date): Promise<Venta[]> {
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
      sql: `SELECT id, total_nio, fecha, items, pagos
            FROM ventas
            ${whereClause}
            ORDER BY fecha DESC`,
      args
    });

    return rows.map((row) => this.mapVentaRow(row));
  }

  public obtenerVentaPorId(id: string): Promise<Venta> {
    return this.fetchVentaById(id);
  }

  public async anularVenta(id: string): Promise<Venta> {
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
    pagos: DetallePago[]
  ): Promise<{ venta: Venta; cambio: number }> {
    if (!items.length) {
      throw new Error("Debe incluir al menos un producto en la venta.");
    }
    if (!pagos.length) {
      throw new Error("Debe registrar al menos un pago.");
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
          const subtotalCents = precioUnitarioCents * item.cantidad;
          return {
            producto,
            cantidad: item.cantidad,
            precioUnitario: centsToAmount(precioUnitarioCents),
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

      const fechaVenta = new Date().toISOString();
      const totalVenta = centsToAmount(totalVentaCents);
      const venta: Venta = {
        id: randomUUID(),
        totalNIO: totalVenta,
        pagos: pagosNormalizados,
        items: ventaItems,
        fecha: fechaVenta
      };

      await tx.execute({
        sql: `INSERT INTO ventas (id, total_nio, fecha, items, pagos)
              VALUES (?, ?, ?, ?, ?)` ,
        args: [
          venta.id,
          venta.totalNIO,
          fechaVenta,
          JSON.stringify(venta.items),
          JSON.stringify(venta.pagos)
        ]
      });

      const cambioCents = totalPagadoCents - totalVentaCents;
      const cambio = centsToAmount(cambioCents);
      return { venta, cambio };
    }, this.client);
  }

  private async obtenerTasaCambio(): Promise<number> {
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
    const { rows } = await executor.execute({
      sql: "SELECT id, total_nio, fecha, items, pagos FROM ventas WHERE id = ?",
      args: [id]
    });

    if (!rows.length) {
      throw new Error("Venta no encontrada.");
    }

    return this.mapVentaRow(rows[0]);
  }

  private async fetchProductoById(id: string, executor: SqlExecutor = this.client): Promise<Producto> {
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

  private mapVentaRow(row: Record<string, unknown>): Venta {
    const items = this.parseJsonField<VentaItem[]>(row.items) ?? [];
    const pagos = this.parseJsonField<DetallePago[]>(row.pagos) ?? [];

    return {
      id: String(row.id),
      totalNIO: Number(row.total_nio ?? 0),
      fecha: typeof row.fecha === "string" ? row.fecha : undefined,
      items: items.map((item) => ({ ...item })),
      pagos: pagos.map((pago) => ({ ...pago }))
    };
  }

  private parseJsonField<T>(value: unknown): T | undefined {
    if (typeof value !== "string" || !value.trim()) {
      return undefined;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      throw new Error("Formato inválido de datos almacenados en la base de datos.");
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
}
