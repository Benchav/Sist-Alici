import { InMemoryDatabase } from "../../infrastructure/database/in-memory-db";
import type { Insumo } from "../../core/entities/types";

export class InventoryService {
  private readonly db = InMemoryDatabase.getInstance();

  public listarInsumos(): Insumo[] {
    return this.db.ingredients.map((insumo) => ({ ...insumo }));
  }

  public registrarCompra(insumoId: string, cantidad: number, costoTotal: number): Insumo {
    if (cantidad <= 0) {
      throw new Error("La cantidad de compra debe ser mayor a cero.");
    }
    if (costoTotal < 0) {
      throw new Error("El costo total de la compra no puede ser negativo.");
    }

    const insumo = this.db.ingredients.find((item) => item.id === insumoId);
    if (!insumo) {
      throw new Error("Insumo no encontrado.");
    }

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
