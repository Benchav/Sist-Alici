import { randomUUID } from "node:crypto";
import type { Transaction } from "@libsql/client";
import type { Insumo } from "../../core/entities/insumo.entity";
import type { Producto } from "../../core/entities/producto.entity";
import type { Receta } from "../../core/entities/receta.entity";
import { getTursoClient } from "../../infrastructure/database/turso";

interface ProductionRecord {
  id: string;
  recetaId: string;
  productoId: string;
  cantidadProducida: number;
  costoIngredientes: number;
  costoManoObra: number;
  costoTotal: number;
  fecha: string;
}

type CreateProductInput = Pick<Producto, "nombre"> & Partial<Omit<Producto, "id" | "nombre">>;
type UpdateProductInput = Partial<Omit<Producto, "id">>;
type UpsertRecetaInput = {
  id?: string;
  productoId: string;
  items: Receta["items"];
  costoManoObra?: number;
};

type SqlExecutor = {
  execute: (statement: string | { sql: string; args?: Array<string | number | null> }) => Promise<any>;
};

export class ProductionService {
  private readonly client = getTursoClient();
  private readonly historial: ProductionRecord[] = [];

  public obtenerHistorial(): ProductionRecord[] {
    return [...this.historial].sort(
      (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    );
  }

  public async listarRecetas(): Promise<Receta[]> {
    const { rows } = await this.client.execute(
      "SELECT id, producto_id, costo_mano_obra, items FROM recetas ORDER BY id"
    );
    return rows.map((row) => this.mapRecetaRow(row));
  }

  public findRecetaById(id: string): Promise<Receta> {
    return this.fetchRecetaById(id);
  }

  public async upsertReceta(data: UpsertRecetaInput): Promise<Receta> {
    await this.findProductById(data.productoId);
    await this.ensureInsumosExist(data.items.map((item) => item.insumoId));

    if (data.id) {
      await this.client.execute({
        sql: `UPDATE recetas
              SET producto_id = ?, costo_mano_obra = ?, items = ?
              WHERE id = ?`,
        args: [
          data.productoId,
          data.costoManoObra ?? null,
          JSON.stringify(data.items),
          data.id
        ]
      });
      return this.findRecetaById(data.id);
    }

    const id = `REC-${randomUUID()}`;
    await this.client.execute({
      sql: `INSERT INTO recetas (id, producto_id, costo_mano_obra, items)
            VALUES (?, ?, ?, ?)` ,
      args: [id, data.productoId, data.costoManoObra ?? null, JSON.stringify(data.items)]
    });

    return {
      id,
      productoId: data.productoId,
      items: data.items,
      costoManoObra: data.costoManoObra
    };
  }

  public async listarProductos(): Promise<Producto[]> {
    const { rows } = await this.client.execute(
      "SELECT id, nombre, stock_disponible, precio_unitario, precio_venta FROM productos ORDER BY nombre"
    );
    return rows.map((row) => this.mapProductoRow(row));
  }

  public findProductById(id: string): Promise<Producto> {
    return this.fetchProductoById(id);
  }

  public async crearProducto(data: CreateProductInput): Promise<Producto> {
    const producto: Producto = {
      id: `PRD-${randomUUID()}`,
      nombre: data.nombre.trim(),
      stockDisponible: data.stockDisponible ?? 0,
      precioUnitario: data.precioUnitario,
      precioVenta: data.precioVenta
    };

    await this.client.execute({
      sql: `INSERT INTO productos (id, nombre, stock_disponible, precio_unitario, precio_venta)
            VALUES (?, ?, ?, ?, ?)` ,
      args: [
        producto.id,
        producto.nombre,
        producto.stockDisponible,
        producto.precioUnitario ?? null,
        producto.precioVenta ?? null
      ]
    });

    return producto;
  }

  public async actualizarProducto(id: string, data: UpdateProductInput): Promise<Producto> {
    const current = await this.findProductById(id);
    const updated: Producto = {
      ...current,
      ...data
    };

    await this.client.execute({
      sql: `UPDATE productos
            SET nombre = ?, stock_disponible = ?, precio_unitario = ?, precio_venta = ?
            WHERE id = ?`,
      args: [
        updated.nombre,
        updated.stockDisponible,
        updated.precioUnitario ?? null,
        updated.precioVenta ?? null,
        id
      ]
    });

    return updated;
  }

  public async eliminarProducto(id: string): Promise<void> {
    const result = await this.client.execute({
      sql: "DELETE FROM productos WHERE id = ?",
      args: [id]
    });

    if ((result.rowsAffected ?? 0) === 0) {
      throw new Error("Producto no encontrado.");
    }

    await this.client.execute({
      sql: "DELETE FROM recetas WHERE producto_id = ?",
      args: [id]
    });
  }

  public async registrarProduccion(recetaId: string, cantidadProducida: number): Promise<ProductionRecord> {
    if (cantidadProducida <= 0) {
      throw new Error("La cantidad producida debe ser mayor a cero.");
    }

    const record = await this.withTransaction(async (tx) => {
      const receta = await this.fetchRecetaById(recetaId, tx);
      const producto = await this.fetchProductoById(receta.productoId, tx);

      const insumoIds = receta.items.map((item) => item.insumoId);
      const insumos = await this.fetchInsumosByIds(insumoIds, tx);

      const consumos = receta.items.map((item) => {
        const insumo = insumos.get(item.insumoId);
        if (!insumo) {
          throw new Error(`Insumo ${item.insumoId} no encontrado.`);
        }

        const requerido = item.cantidad * cantidadProducida;
        if (insumo.stock < requerido) {
          throw new Error(`Stock insuficiente para el insumo ${insumo.nombre}.`);
        }

        return { insumo, requerido };
      });

      let costoIngredientes = 0;
      for (const { insumo, requerido } of consumos) {
        costoIngredientes += requerido * insumo.costoPromedio;
        const nuevoStock = insumo.stock - requerido;
        await tx.execute({
          sql: "UPDATE insumos SET stock = ? WHERE id = ?",
          args: [nuevoStock, insumo.id]
        });
      }

      const nuevoStockProducto = producto.stockDisponible + cantidadProducida;
      await tx.execute({
        sql: "UPDATE productos SET stock_disponible = ? WHERE id = ?",
        args: [nuevoStockProducto, producto.id]
      });

      const costoManoObra = receta.costoManoObra ?? 0;
      const costoTotal = costoIngredientes + costoManoObra;

      const registro: ProductionRecord = {
        id: randomUUID(),
        recetaId,
        productoId: producto.id,
        cantidadProducida,
        costoIngredientes: Number(costoIngredientes.toFixed(4)),
        costoManoObra: Number(costoManoObra.toFixed(4)),
        costoTotal: Number(costoTotal.toFixed(4)),
        fecha: new Date().toISOString()
      };

      return registro;
    });

    this.historial.push(record);
    return record;
  }

  private async withTransaction<T>(handler: (tx: Transaction) => Promise<T>): Promise<T> {
    const tx = await this.client.transaction();
    try {
      const result = await handler(tx);
      await tx.commit();
      return result;
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }

  private async fetchRecetaById(id: string, executor: SqlExecutor = this.client): Promise<Receta> {
    const { rows } = await executor.execute({
      sql: "SELECT id, producto_id, costo_mano_obra, items FROM recetas WHERE id = ?",
      args: [id]
    });

    if (!rows.length) {
      throw new Error("Receta no encontrada.");
    }

    return this.mapRecetaRow(rows[0]);
  }

  private async fetchProductoById(id: string, executor: SqlExecutor = this.client): Promise<Producto> {
    const { rows } = await executor.execute({
      sql: "SELECT id, nombre, stock_disponible, precio_unitario, precio_venta FROM productos WHERE id = ?",
      args: [id]
    });

    if (!rows.length) {
      throw new Error("Producto no encontrado.");
    }

    return this.mapProductoRow(rows[0]);
  }

  private async ensureInsumosExist(ids: string[]): Promise<void> {
    if (!ids.length) {
      throw new Error("La receta debe incluir al menos un insumo.");
    }

    const placeholders = ids.map(() => "?").join(",");
    const { rows } = await this.client.execute({
      sql: `SELECT id FROM insumos WHERE id IN (${placeholders})`,
      args: ids
    });

    if (rows.length !== new Set(ids).size) {
      throw new Error("Uno o más insumos especificados no existen.");
    }
  }

  private async fetchInsumosByIds(ids: string[], executor: SqlExecutor): Promise<Map<string, Insumo & { nombre: string }>> {
    if (!ids.length) {
      return new Map();
    }

    const placeholders = ids.map(() => "?").join(",");
    const { rows } = await executor.execute({
      sql: `SELECT id, nombre, unidad, stock, costo_promedio FROM insumos WHERE id IN (${placeholders})`,
      args: ids
    });

    const map = new Map<string, Insumo & { nombre: string }>();
    rows.forEach((row: Record<string, unknown>) => {
      const insumo = this.mapInsumoRow(row);
      map.set(insumo.id, insumo);
    });
    return map;
  }

  private mapRecetaRow(row: Record<string, unknown>): Receta {
    return {
      id: String(row.id),
      productoId: String(row.producto_id),
      costoManoObra:
        row.costo_mano_obra !== null && row.costo_mano_obra !== undefined
          ? Number(row.costo_mano_obra)
          : undefined,
      items: this.parseItems(row.items)
    };
  }

  private mapProductoRow(row: Record<string, unknown>): Producto {
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

  private mapInsumoRow(row: Record<string, unknown>): Insumo & { nombre: string } {
    return {
      id: String(row.id),
      nombre: String(row.nombre),
      unidad: String(row.unidad ?? ""),
      stock: Number(row.stock ?? 0),
      costoPromedio: Number(row.costo_promedio ?? 0)
    };
  }

  private parseItems(value: unknown): Receta["items"] {
    if (typeof value !== "string" || !value.trim()) {
      return [];
    }

    try {
      const parsed = JSON.parse(value) as Receta["items"];
      return parsed.map((item) => ({ ...item }));
    } catch {
      throw new Error("Formato inválido de items de receta.");
    }
  }
}
