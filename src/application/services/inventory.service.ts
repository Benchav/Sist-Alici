import { randomUUID } from "node:crypto";
import { InMemoryDatabase } from "../../infrastructure/database/in-memory-db";
import type { Insumo } from "../../core/entities/insumo.entity";

type CreateInsumoInput = Pick<Insumo, "nombre" | "unidad"> & Partial<Pick<Insumo, "stock" | "costoPromedio">>;
type UpdateInsumoInput = Partial<Omit<Insumo, "id">>;

export class InventoryService {
  private readonly db = InMemoryDatabase.getInstance();

  public findAll(): Insumo[] {
    return this.db.ingredients.map((insumo) => ({ ...insumo }));
  }

  public listarInsumos(): Insumo[] {
    return this.findAll();
  }

  public findById(id: string): Insumo {
    const insumo = this.db.ingredients.find((item) => item.id === id);
    if (!insumo) {
      throw new Error("Insumo no encontrado.");
    }
    return insumo;
  }

  public createInsumo(input: CreateInsumoInput): Insumo {
    const nuevo: Insumo = {
      id: `INS-${randomUUID()}`,
      nombre: input.nombre.trim(),
      unidad: input.unidad.trim(),
      stock: input.stock ?? 0,
      costoPromedio: input.costoPromedio ?? 0
    };
    this.db.ingredients.push(nuevo);
    return nuevo;
  }

  public updateInsumo(id: string, data: UpdateInsumoInput): Insumo {
    const insumo = this.findById(id);
    Object.assign(insumo, data);
    return insumo;
  }

  public deleteInsumo(id: string): void {
    const index = this.db.ingredients.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error("Insumo no encontrado.");
    }
    this.db.ingredients.splice(index, 1);
  }

  public registrarCompra(insumoId: string, cantidad: number, costoTotal: number): Insumo {
    if (cantidad <= 0) {
      throw new Error("La cantidad de compra debe ser mayor a cero.");
    }
    if (costoTotal < 0) {
      throw new Error("El costo total de la compra no puede ser negativo.");
    }

    const insumo = this.findById(insumoId);

    const stockActual = insumo.stock;
    const costoActual = insumo.costoPromedio;
    const nuevoStock = stockActual + cantidad;

    const nuevoCostoPromedio =
      nuevoStock === 0 ? 0 : ((stockActual * costoActual) + costoTotal) / nuevoStock;

    insumo.stock = nuevoStock;
    insumo.costoPromedio = Number(nuevoCostoPromedio.toFixed(4));

    return insumo;
  }
}
