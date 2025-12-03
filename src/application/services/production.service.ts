import { randomUUID } from "node:crypto";
import type { Insumo } from "../../core/entities/insumo.entity";
import type { Producto } from "../../core/entities/producto.entity";
import { fromCents, toCents } from "../../core/utils/currency";
import { getTursoClient, withTursoTransaction } from "../../infrastructure/database/turso";

interface ProductionRecord {
  id: string;
  productoId: string;
  volumenSolicitado: number;
  unidadVolumen: string;
  factorReceta: number;
  costoIngredientes: number;
  costoManoObra: number;
  costoTotal: number;
  costoUnitario?: number;
  insumosConsumidos?: Array<{
    insumoId: string;
    cantidad: number;
    costoUnitario: number;
    costoTotal: number;
  }>;
  fecha: string;
}

type ProductionBatchInput = {
  id?: string;
  productoId: string;
  rendimientoBase: number;
  costoManoObra?: number;
  items: Array<{ insumoId: string; cantidad: number }>;
};

type DailyProductionLotInput = {
  productoId: string;
  cantidadProducida: number;
  costoManoObra?: number;
  insumos: Array<{ insumoId: string; cantidad: number }>;
};

type CreateProductInput = Pick<Producto, "nombre"> & Partial<Omit<Producto, "id" | "nombre">>;
type UpdateProductInput = Partial<Omit<Producto, "id">>;
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

  public async listarProductos(): Promise<Producto[]> {
    const { rows } = await this.client.execute(
      "SELECT id, nombre, stock_disponible, precio_unitario, precio_venta, categoria_id FROM productos ORDER BY nombre"
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
      precioVenta: data.precioVenta,
      categoriaId: data.categoriaId
    };

    await this.client.execute({
      sql: `INSERT INTO productos (id, nombre, stock_disponible, precio_unitario, precio_venta, categoria_id)
            VALUES (?, ?, ?, ?, ?, ?)` ,
      args: [
        producto.id,
        producto.nombre,
        producto.stockDisponible,
        producto.precioUnitario ?? null,
        producto.precioVenta ?? null,
        producto.categoriaId ?? null
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
            SET nombre = ?, stock_disponible = ?, precio_unitario = ?, precio_venta = ?, categoria_id = ?
            WHERE id = ?`,
      args: [
        updated.nombre,
        updated.stockDisponible,
        updated.precioUnitario ?? null,
        updated.precioVenta ?? null,
        updated.categoriaId ?? null,
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
  }

  public async registrarProduccionPorVolumen(batchData: ProductionBatchInput[]): Promise<ProductionRecord[]> {
    if (!Array.isArray(batchData) || !batchData.length) {
      throw new Error("Debe proporcionar al menos un lote de producción.");
    }

    const resultados: ProductionRecord[] = [];

    for (const lote of batchData) {
      if (!lote?.productoId) {
        throw new Error("Cada lote debe especificar un producto.");
      }
      if (!Array.isArray(lote.items) || !lote.items.length) {
        throw new Error("Cada lote debe incluir insumos a consumir.");
      }
      if (!Number.isFinite(lote.rendimientoBase) || lote.rendimientoBase <= 0) {
        throw new Error("El rendimiento base debe ser mayor a cero.");
      }

      const registro = await withTursoTransaction(async (tx) => {
        const producto = await this.fetchProductoById(lote.productoId, tx);
        const insumoIds = lote.items.map((item) => item.insumoId);
        const insumos = await this.fetchInsumosByIds(insumoIds, tx);

        const consumos = lote.items.map((item) => {
          const requerido = Number(item.cantidad);
          if (!Number.isFinite(requerido) || requerido <= 0) {
            throw new Error("La cantidad de cada insumo debe ser mayor a cero.");
          }

          const insumo = insumos.get(item.insumoId);
          if (!insumo) {
            throw new Error(`Insumo ${item.insumoId} no encontrado.`);
          }
          if (insumo.stock < requerido) {
            throw new Error(`Stock insuficiente para el insumo ${insumo.nombre}.`);
          }

          return { insumo, requerido };
        });

        const costoIngredientesCents = consumos.reduce((acc, { insumo, requerido }) => {
          const unitCostCents = toCents(insumo.costoPromedio);
          return acc + Math.round(unitCostCents * requerido);
        }, 0);

        for (const { insumo, requerido } of consumos) {
          const nuevoStock = insumo.stock - requerido;
          await tx.execute({
            sql: "UPDATE insumos SET stock = ? WHERE id = ?",
            args: [nuevoStock, insumo.id]
          });
        }

        const nuevoStockProducto = producto.stockDisponible + lote.rendimientoBase;
        await tx.execute({
          sql: "UPDATE productos SET stock_disponible = ? WHERE id = ?",
          args: [nuevoStockProducto, producto.id]
        });

        const costoManoObraTotalCents = toCents(lote.costoManoObra ?? 0);
        const costoTotalCents = costoIngredientesCents + costoManoObraTotalCents;
        const costoUnitarioCents = Math.round(costoTotalCents / lote.rendimientoBase);

        const registro: ProductionRecord = {
          id: randomUUID(),
          productoId: producto.id,
          volumenSolicitado: lote.rendimientoBase,
          unidadVolumen: "UNIDADES",
          factorReceta: 1,
          costoIngredientes: fromCents(costoIngredientesCents),
          costoManoObra: fromCents(costoManoObraTotalCents),
          costoTotal: fromCents(costoTotalCents),
          costoUnitario: fromCents(costoUnitarioCents),
          fecha: new Date().toISOString()
        };

        return registro;
      }, this.client);

      this.historial.push(registro);
      resultados.push(registro);
    }

    return resultados;
  }

  public async registrarProduccionDiaria(lotes: DailyProductionLotInput[]): Promise<ProductionRecord[]> {
    if (!Array.isArray(lotes) || !lotes.length) {
      throw new Error("Debe proporcionar al menos un lote para registrar la producción diaria.");
    }

    const registros = await withTursoTransaction(async (tx) => {
      const productoStockCache = new Map<string, number>();
      const insumoStockCache = new Map<string, number>();
      const registrosLocales: ProductionRecord[] = [];

      for (const lote of lotes) {
        if (!lote?.productoId) {
          throw new Error("Cada lote debe especificar un producto.");
        }
        if (!Array.isArray(lote.insumos) || !lote.insumos.length) {
          throw new Error("Cada lote debe incluir al menos un insumo consumido.");
        }

        const cantidadProducida = Number(lote.cantidadProducida);
        if (!Number.isFinite(cantidadProducida) || cantidadProducida <= 0) {
          throw new Error("La cantidad producida debe ser mayor a cero.");
        }

        const costoManoObraCents = toCents(lote.costoManoObra ?? 0);
        if (costoManoObraCents < 0) {
          throw new Error("El costo de mano de obra no puede ser negativo.");
        }

        const producto = await this.fetchProductoById(lote.productoId, tx);
        const insumoIds = lote.insumos.map((insumo) => insumo.insumoId);
        const insumos = await this.fetchInsumosByIds(insumoIds, tx);

        const consumos = lote.insumos.map((entrada) => {
          const cantidad = Number(entrada.cantidad);
          if (!Number.isFinite(cantidad) || cantidad <= 0) {
            throw new Error("La cantidad consumida de cada insumo debe ser mayor a cero.");
          }

          const insumo = insumos.get(entrada.insumoId);
          if (!insumo) {
            throw new Error(`Insumo ${entrada.insumoId} no encontrado.`);
          }

          const stockActual = insumoStockCache.get(insumo.id) ?? insumo.stock;
          if (stockActual < cantidad) {
            throw new Error(`Stock insuficiente para el insumo ${insumo.nombre}.`);
          }

          const costoUnitarioCents = toCents(insumo.costoPromedio);
          const costoTotalCents = Math.round(costoUnitarioCents * cantidad);

          return {
            insumo,
            cantidad,
            costoUnitarioCents,
            costoTotalCents,
            nuevoStock: stockActual - cantidad
          };
        });

        for (const consumo of consumos) {
          insumoStockCache.set(consumo.insumo.id, consumo.nuevoStock);
          await tx.execute({
            sql: "UPDATE insumos SET stock = ? WHERE id = ?",
            args: [consumo.nuevoStock, consumo.insumo.id]
          });
        }

        const costoIngredientesCents = consumos.reduce((acc, item) => acc + item.costoTotalCents, 0);
        const costoTotalCents = costoIngredientesCents + costoManoObraCents;
        const costoUnitarioCents = Math.round(costoTotalCents / cantidadProducida);

        const stockProductoActual = productoStockCache.get(producto.id) ?? producto.stockDisponible;
        const nuevoStockProducto = stockProductoActual + cantidadProducida;
        productoStockCache.set(producto.id, nuevoStockProducto);

        await tx.execute({
          sql: "UPDATE productos SET stock_disponible = ?, precio_unitario = ? WHERE id = ?",
          args: [nuevoStockProducto, fromCents(costoUnitarioCents), producto.id]
        });

        const fechaRegistro = new Date().toISOString();
        registrosLocales.push({
          id: randomUUID(),
          productoId: producto.id,
          volumenSolicitado: cantidadProducida,
          unidadVolumen: "UNIDADES",
          factorReceta: 1,
          costoIngredientes: fromCents(costoIngredientesCents),
          costoManoObra: fromCents(costoManoObraCents),
          costoTotal: fromCents(costoTotalCents),
          costoUnitario: fromCents(costoUnitarioCents),
          insumosConsumidos: consumos.map((consumo) => ({
            insumoId: consumo.insumo.id,
            cantidad: consumo.cantidad,
            costoUnitario: fromCents(consumo.costoUnitarioCents),
            costoTotal: fromCents(consumo.costoTotalCents)
          })),
          fecha: fechaRegistro
        });
      }

      return registrosLocales;
    }, this.client);

    this.historial.push(...registros);
    return registros;
  }

  private async fetchProductoById(id: string, executor: SqlExecutor = this.client): Promise<Producto> {
    const { rows } = await executor.execute({
      sql: "SELECT id, nombre, stock_disponible, precio_unitario, precio_venta, categoria_id FROM productos WHERE id = ?",
      args: [id]
    });

    if (!rows.length) {
      throw new Error("Producto no encontrado.");
    }

    return this.mapProductoRow(rows[0]);
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
          : undefined,
      categoriaId:
        row.categoria_id !== null && row.categoria_id !== undefined
          ? String(row.categoria_id)
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

}
