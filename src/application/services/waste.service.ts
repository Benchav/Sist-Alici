import { randomUUID } from "node:crypto";
import type { Descarte } from "../../core/entities/descarte.entity";
import type { Producto } from "../../core/entities/producto.entity";
import { getTursoClient, withTursoTransaction } from "../../infrastructure/database/turso";

type SqlExecutor = {
  execute: (statement: string | { sql: string; args?: Array<string | number | null> }) => Promise<any>;
};

export class WasteService {
  private readonly client = getTursoClient();

  public async registrarDescarte(
    productoId: string,
    cantidad: number,
    motivo?: string
  ): Promise<Descarte> {
    if (!productoId?.trim()) {
      throw new Error("El producto es requerido para registrar un descarte.");
    }
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      throw new Error("La cantidad descartada debe ser mayor a cero.");
    }

    return await withTursoTransaction(async (tx) => {
      const producto = await this.fetchProducto(productoId, tx);
      if (producto.stockDisponible < cantidad) {
        throw new Error("Stock insuficiente para registrar el descarte.");
      }

      const nuevoStock = producto.stockDisponible - cantidad;
      await tx.execute({
        sql: "UPDATE productos SET stock_disponible = ? WHERE id = ?",
        args: [nuevoStock, productoId]
      });

      const id = `DSC-${randomUUID()}`;
      const fecha = new Date().toISOString();
      await tx.execute({
        sql: `INSERT INTO descartes (id, producto_id, cantidad, motivo, fecha)
              VALUES (?, ?, ?, ?, ?)` ,
        args: [id, productoId, cantidad, motivo?.trim() ?? null, fecha]
      });

      return {
        id,
        productoId,
        cantidad,
        motivo: motivo?.trim(),
        fecha
      };
    }, this.client);
  }

  private async fetchProducto(id: string, executor: SqlExecutor): Promise<Producto> {
    const { rows } = await executor.execute({
      sql: "SELECT id, nombre, stock_disponible, precio_unitario, precio_venta FROM productos WHERE id = ?",
      args: [id]
    });

    if (!rows.length) {
      throw new Error("Producto no encontrado.");
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
        row.precio_venta !== null && row.precio_venta !== undefined ? Number(row.precio_venta) : undefined,
      categoriaId:
        row.categoria_id !== null && row.categoria_id !== undefined ? String(row.categoria_id) : undefined
    };
  }
}
