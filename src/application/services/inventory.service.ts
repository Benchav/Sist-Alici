import { randomUUID } from "node:crypto";
import type { Categoria, CategoriaTipo } from "../../core/entities/categoria.entity";
import type { Insumo } from "../../core/entities/insumo.entity";
import type { Producto } from "../../core/entities/producto.entity";
import type { Proveedor } from "../../core/entities/proveedor.entity";
import { fromCents, toCents } from "../../core/utils/currency";
import { getTursoClient, withTursoTransaction } from "../../infrastructure/database/turso";

type CreateInsumoInput = Pick<Insumo, "nombre" | "unidad"> & Partial<Pick<Insumo, "stock" | "costoPromedio" | "proveedorPrincipalId">>;
type UpdateInsumoInput = Partial<Omit<Insumo, "id">>;
type CreateCategoriaInput = Pick<Categoria, "nombre" | "tipo">;
type UpdateCategoriaInput = Partial<Omit<Categoria, "id">>;
type CreateProveedorInput = Pick<Proveedor, "nombre"> & Partial<Omit<Proveedor, "id" | "nombre">>;
type UpdateProveedorInput = Partial<Omit<Proveedor, "id">>;
type SqlExecutor = {
  execute: (statement: string | { sql: string; args?: Array<string | number | null> }) => Promise<any>;
};

type ProductoRow = Producto & { categoriaTipo?: CategoriaTipo };

const CATEGORIA_TIPOS: CategoriaTipo[] = ["PRODUCCION", "REVENTA", "INSUMO"];

export class InventoryService {
  private readonly client = getTursoClient();

  public async findAll(): Promise<Insumo[]> {
    const { rows } = await this.client.execute(
      "SELECT id, nombre, unidad, stock, costo_promedio, proveedor_principal_id FROM insumos ORDER BY nombre"
    );
    return rows.map((row) => this.mapRow(row));
  }

  public listarInsumos(): Promise<Insumo[]> {
    return this.findAll();
  }

  public async findById(id: string): Promise<Insumo> {
    const { rows } = await this.client.execute({
      sql: "SELECT id, nombre, unidad, stock, costo_promedio, proveedor_principal_id FROM insumos WHERE id = ?",
      args: [id]
    });

    if (!rows.length) {
      throw new Error("Insumo no encontrado.");
    }

    return this.mapRow(rows[0]);
  }

  public async createInsumo(input: CreateInsumoInput): Promise<Insumo> {
    const insumo: Insumo = {
      id: `INS-${randomUUID()}`,
      nombre: input.nombre.trim(),
      unidad: input.unidad.trim(),
      stock: input.stock ?? 0,
      costoPromedio: input.costoPromedio ?? 0,
      proveedorPrincipalId: input.proveedorPrincipalId
    };

    await this.client.execute({
      sql: `INSERT INTO insumos (id, nombre, unidad, stock, costo_promedio, proveedor_principal_id)
            VALUES (?, ?, ?, ?, ?, ?)` ,
      args: [
        insumo.id,
        insumo.nombre,
        insumo.unidad,
        insumo.stock,
        insumo.costoPromedio,
        insumo.proveedorPrincipalId ?? null
      ]
    });

    return insumo;
  }

  public async updateInsumo(id: string, data: UpdateInsumoInput): Promise<Insumo> {
    const current = await this.findById(id);
    const updated: Insumo = {
      ...current,
      ...data
    };

    await this.client.execute({
      sql: `UPDATE insumos
            SET nombre = ?, unidad = ?, stock = ?, costo_promedio = ?, proveedor_principal_id = ?
            WHERE id = ?`,
      args: [
        updated.nombre,
        updated.unidad,
        updated.stock,
        updated.costoPromedio,
        updated.proveedorPrincipalId ?? null,
        id
      ]
    });

    return updated;
  }

  public async deleteInsumo(id: string): Promise<void> {
    const result = await this.client.execute({
      sql: "DELETE FROM insumos WHERE id = ?",
      args: [id]
    });

    if ((result.rowsAffected ?? 0) === 0) {
      throw new Error("Insumo no encontrado.");
    }
  }

  public async registrarCompra(insumoId: string, cantidad: number, costoTotal: number): Promise<Insumo> {
    if (cantidad <= 0) {
      throw new Error("La cantidad de compra debe ser mayor a cero.");
    }
    if (costoTotal < 0) {
      throw new Error("El costo total de la compra no puede ser negativo.");
    }

    const insumo = await this.findById(insumoId);

    const stockActual = insumo.stock;
    const nuevoStock = stockActual + cantidad;

    if (nuevoStock <= 0) {
      throw new Error("El stock resultante debe ser mayor a cero.");
    }

    const costoActualCents = toCents(insumo.costoPromedio);
    const costoActualTotalCents = Math.round(stockActual * costoActualCents);
    const costoTotalCents = toCents(costoTotal);
    const nuevoCostoPromedioCents = Math.round((costoActualTotalCents + costoTotalCents) / nuevoStock);

    const actualizado: Insumo = {
      ...insumo,
      stock: nuevoStock,
      costoPromedio: fromCents(nuevoCostoPromedioCents)
    };

    await this.client.execute({
      sql: `UPDATE insumos SET stock = ?, costo_promedio = ? WHERE id = ?`,
      args: [actualizado.stock, actualizado.costoPromedio, insumoId]
    });

    return actualizado;
  }

  public async registrarCompraProductoTerminado(
    productoId: string,
    cantidad: number,
    costoTotal: number
  ): Promise<Producto> {
    if (cantidad <= 0) {
      throw new Error("La cantidad de compra debe ser mayor a cero.");
    }
    if (costoTotal < 0) {
      throw new Error("El costo total de la compra no puede ser negativo.");
    }

    return await withTursoTransaction(async (tx) => {
      const producto = await this.fetchProducto(tx, productoId);
      if (!producto.categoriaId) {
        throw new Error("El producto debe pertenecer a una categoría para registrar compras.");
      }
      if (producto.categoriaTipo !== "REVENTA") {
        throw new Error("Solo se pueden registrar compras de productos de reventa.");
      }
      const stockActual = producto.stockDisponible;
      const nuevoStock = stockActual + cantidad;
      if (nuevoStock <= 0) {
        throw new Error("El stock resultante debe ser mayor a cero.");
      }

      const costoActualCents = toCents(producto.precioUnitario ?? 0);
      const costoActualTotalCents = Math.round(stockActual * costoActualCents);
      const costoCompraCents = toCents(costoTotal);
      const nuevoCostoUnitarioCents = Math.round((costoActualTotalCents + costoCompraCents) / nuevoStock);
      const nuevoCostoUnitario = fromCents(nuevoCostoUnitarioCents);

      await tx.execute({
        sql: `UPDATE productos SET stock_disponible = ?, precio_unitario = ? WHERE id = ?`,
        args: [nuevoStock, nuevoCostoUnitario, productoId]
      });

      return {
        ...producto,
        stockDisponible: nuevoStock,
        precioUnitario: nuevoCostoUnitario
      };
    }, this.client);
  }

  public async listarCategorias(): Promise<Categoria[]> {
    const { rows } = await this.client.execute(
      "SELECT id, nombre, tipo FROM categorias ORDER BY nombre"
    );
    return rows.map((row) => this.mapCategoriaRow(row));
  }

  public async crearCategoria(input: CreateCategoriaInput): Promise<Categoria> {
    const categoria: Categoria = {
      id: `CAT-${randomUUID()}`,
      nombre: input.nombre.trim(),
      tipo: this.normalizeCategoriaTipo(input.tipo)
    };

    await this.client.execute({
      sql: "INSERT INTO categorias (id, nombre, tipo) VALUES (?, ?, ?)",
      args: [categoria.id, categoria.nombre, categoria.tipo]
    });

    return categoria;
  }

  public async actualizarCategoria(id: string, input: UpdateCategoriaInput): Promise<Categoria> {
    const current = await this.findCategoriaById(id);
    const updated: Categoria = {
      ...current,
      ...input,
      nombre: input.nombre !== undefined ? input.nombre.trim() : current.nombre,
      tipo: input.tipo ? this.normalizeCategoriaTipo(input.tipo) : current.tipo
    };

    await this.client.execute({
      sql: "UPDATE categorias SET nombre = ?, tipo = ? WHERE id = ?",
      args: [updated.nombre, updated.tipo, id]
    });

    return updated;
  }

  public async eliminarCategoria(id: string): Promise<void> {
    const result = await this.client.execute({
      sql: "DELETE FROM categorias WHERE id = ?",
      args: [id]
    });

    if ((result.rowsAffected ?? 0) === 0) {
      throw new Error("Categoría no encontrada.");
    }
  }

  public async listarProveedores(): Promise<Proveedor[]> {
    const { rows } = await this.client.execute(
      "SELECT id, nombre, frecuencia_credito, contacto FROM proveedores ORDER BY nombre"
    );
    return rows.map((row) => this.mapProveedorRow(row));
  }

  public async crearProveedor(input: CreateProveedorInput): Promise<Proveedor> {
    const proveedor: Proveedor = {
      id: `PROV-${randomUUID()}`,
      nombre: input.nombre.trim(),
      frecuenciaCredito: input.frecuenciaCredito?.trim(),
      contacto: input.contacto?.trim()
    };

    await this.client.execute({
      sql: `INSERT INTO proveedores (id, nombre, frecuencia_credito, contacto)
            VALUES (?, ?, ?, ?)` ,
      args: [
        proveedor.id,
        proveedor.nombre,
        proveedor.frecuenciaCredito ?? null,
        proveedor.contacto ?? null
      ]
    });

    return proveedor;
  }

  public async actualizarProveedor(id: string, input: UpdateProveedorInput): Promise<Proveedor> {
    const current = await this.findProveedorById(id);
    const updated: Proveedor = {
      ...current,
      ...input,
      nombre: input.nombre !== undefined ? input.nombre.trim() : current.nombre,
      frecuenciaCredito:
        input.frecuenciaCredito !== undefined
          ? input.frecuenciaCredito?.trim()
          : current.frecuenciaCredito,
      contacto: input.contacto !== undefined ? input.contacto?.trim() : current.contacto
    };

    await this.client.execute({
      sql: `UPDATE proveedores
            SET nombre = ?, frecuencia_credito = ?, contacto = ?
            WHERE id = ?`,
      args: [updated.nombre, updated.frecuenciaCredito ?? null, updated.contacto ?? null, id]
    });

    return updated;
  }

  public async eliminarProveedor(id: string): Promise<void> {
    const result = await this.client.execute({
      sql: "DELETE FROM proveedores WHERE id = ?",
      args: [id]
    });

    if ((result.rowsAffected ?? 0) === 0) {
      throw new Error("Proveedor no encontrado.");
    }
  }

  private mapRow(row: Record<string, unknown>): Insumo {
    return {
      id: String(row.id),
      nombre: String(row.nombre),
      unidad: String(row.unidad),
      stock: Number(row.stock ?? 0),
      costoPromedio: Number(row.costo_promedio ?? 0),
      proveedorPrincipalId:
        row.proveedor_principal_id !== null && row.proveedor_principal_id !== undefined
          ? String(row.proveedor_principal_id)
          : undefined
    };
  }

  private async findCategoriaById(id: string): Promise<Categoria> {
    const { rows } = await this.client.execute({
      sql: "SELECT id, nombre, tipo FROM categorias WHERE id = ?",
      args: [id]
    });

    if (!rows.length) {
      throw new Error("Categoría no encontrada.");
    }

    return this.mapCategoriaRow(rows[0]);
  }

  private async findProveedorById(id: string): Promise<Proveedor> {
    const { rows } = await this.client.execute({
      sql: "SELECT id, nombre, frecuencia_credito, contacto FROM proveedores WHERE id = ?",
      args: [id]
    });

    if (!rows.length) {
      throw new Error("Proveedor no encontrado.");
    }

    return this.mapProveedorRow(rows[0]);
  }

  private mapCategoriaRow(row: Record<string, unknown>): Categoria {
    return {
      id: String(row.id),
      nombre: String(row.nombre),
      tipo: this.normalizeCategoriaTipo(String(row.tipo))
    };
  }

  private mapProveedorRow(row: Record<string, unknown>): Proveedor {
    return {
      id: String(row.id),
      nombre: String(row.nombre),
      frecuenciaCredito:
        row.frecuencia_credito !== null && row.frecuencia_credito !== undefined
          ? String(row.frecuencia_credito)
          : undefined,
      contacto:
        row.contacto !== null && row.contacto !== undefined
          ? String(row.contacto)
          : undefined
    };
  }

  private normalizeCategoriaTipo(tipo?: string): CategoriaTipo {
    const normalized = String(tipo ?? "").toUpperCase() as CategoriaTipo;
    if (!CATEGORIA_TIPOS.includes(normalized)) {
      throw new Error("Tipo de categoría inválido.");
    }
    return normalized;
  }

  private async fetchProducto(executor: SqlExecutor, productoId: string): Promise<ProductoRow> {
    const { rows } = await executor.execute({
      sql: `SELECT p.id, p.nombre, p.stock_disponible, p.precio_unitario, p.precio_venta, p.categoria_id, c.tipo as categoria_tipo
            FROM productos p
            LEFT JOIN categorias c ON c.id = p.categoria_id
            WHERE p.id = ?`,
      args: [productoId]
    });

    if (!rows.length) {
      throw new Error("Producto no encontrado.");
    }

    return this.mapProductoRow(rows[0]);
  }

  private mapProductoRow(row: Record<string, unknown>): ProductoRow {
    const categoriaTipoRaw = row.categoria_tipo;
    const categoriaTipo =
      categoriaTipoRaw !== null && categoriaTipoRaw !== undefined
        ? (String(categoriaTipoRaw).toUpperCase() as CategoriaTipo)
        : undefined;
    if (categoriaTipo && !CATEGORIA_TIPOS.includes(categoriaTipo)) {
      throw new Error("Tipo de categoría inválido para el producto.");
    }

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
          : undefined,
      categoriaTipo
    };
  }
}
