import { randomUUID } from "node:crypto";
import { InMemoryDatabase } from "../../infrastructure/database/in-memory-db";
import type { Insumo, Producto, Receta } from "../../core/entities/types";

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

export class ProductionService {
  private readonly db = InMemoryDatabase.getInstance();
  private readonly historial: ProductionRecord[] = [];

  public listarRecetas(): Receta[] {
    return this.db.recipes.map((receta) => ({
      ...receta,
      items: receta.items.map((item) => ({ ...item }))
    }));
  }

  public registrarProduccion(recetaId: string, cantidadProducida: number) {
    if (cantidadProducida <= 0) {
      throw new Error("La cantidad producida debe ser mayor a cero.");
    }

    const receta = this.db.recipes.find((item) => item.id === recetaId) as Receta | undefined;
    if (!receta) {
      throw new Error("Receta no encontrada.");
    }

    const consumos = receta.items.map((item) => {
      const insumo = this.db.ingredients.find((ing) => ing.id === item.insumoId) as Insumo | undefined;
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
    consumos.forEach(({ insumo, requerido }) => {
      costoIngredientes += requerido * insumo.costoPromedio;
      insumo.stock -= requerido;
    });

    const producto = this.db.products.find((prod) => prod.id === receta.productoId) as Producto | undefined;
    if (!producto) {
      throw new Error("Producto asociado no encontrado.");
    }

    producto.stockDisponible += cantidadProducida;

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

    this.historial.push(registro);

    return registro;
  }
}
