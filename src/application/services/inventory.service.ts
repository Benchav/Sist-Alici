import { randomUUID } from "node:crypto";
import { getTursoClient } from "../../infrastructure/database/turso";
import type { Insumo } from "../../core/entities/insumo.entity";
import { fromCents, toCents } from "../../core/utils/currency";

type CreateInsumoInput = Pick<Insumo, "nombre" | "unidad"> & Partial<Pick<Insumo, "stock" | "costoPromedio">>;
type UpdateInsumoInput = Partial<Omit<Insumo, "id">>;

export class InventoryService {
  private readonly client = getTursoClient();

  public async findAll(): Promise<Insumo[]> {
    const { rows } = await this.client.execute(
      "SELECT id, nombre, unidad, stock, costo_promedio FROM insumos ORDER BY nombre"
    );
    return rows.map((row) => this.mapRow(row));
  }

  public listarInsumos(): Promise<Insumo[]> {
    return this.findAll();
  }

  public async findById(id: string): Promise<Insumo> {
    const { rows } = await this.client.execute({
      sql: "SELECT id, nombre, unidad, stock, costo_promedio FROM insumos WHERE id = ?",
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
      costoPromedio: input.costoPromedio ?? 0
    };

    await this.client.execute({
      sql: `INSERT INTO insumos (id, nombre, unidad, stock, costo_promedio)
            VALUES (?, ?, ?, ?, ?)` ,
      args: [insumo.id, insumo.nombre, insumo.unidad, insumo.stock, insumo.costoPromedio]
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
            SET nombre = ?, unidad = ?, stock = ?, costo_promedio = ?
            WHERE id = ?`,
      args: [updated.nombre, updated.unidad, updated.stock, updated.costoPromedio, id]
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

  private mapRow(row: Record<string, unknown>): Insumo {
    return {
      id: String(row.id),
      nombre: String(row.nombre),
      unidad: String(row.unidad),
      stock: Number(row.stock ?? 0),
      costoPromedio: Number(row.costo_promedio ?? 0)
    };
  }
}
