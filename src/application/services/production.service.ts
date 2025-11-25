import { randomUUID } from "node:crypto";
import { InMemoryDatabase } from "../../infrastructure/database/in-memory-db";
import type { Insumo } from "../../core/entities/insumo.entity";
import type { Producto } from "../../core/entities/producto.entity";
import type { Receta } from "../../core/entities/receta.entity";

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

type CreateProductInput = Pick<Producto, "nombre"> & Partial<Omit<Producto, "id" | "nombre" >>;
type UpdateProductInput = Partial<Omit<Producto, "id">>;
type UpsertRecetaInput = {
  id?: string;
  productoId: string;
  items: Receta["items"];
  costoManoObra?: number;
};

export class ProductionService {
  private readonly db = InMemoryDatabase.getInstance();
  private readonly historial: ProductionRecord[] = [];

  public listarRecetas(): Receta[] {
    return this.db.recipes.map((receta) => ({
      ...receta,
      items: receta.items.map((item) => ({ ...item }))
    }));
  }

  public findRecetaById(id: string): Receta {
    const receta = this.db.recipes.find((item) => item.id === id);
    if (!receta) {
      throw new Error("Receta no encontrada.");
    }
    return receta;
  }

  public upsertReceta(data: UpsertRecetaInput): Receta {
    this.findProductById(data.productoId);
    data.items.forEach((item) => {
      const insumo = this.db.ingredients.find((ing) => ing.id === item.insumoId);
      if (!insumo) {
        throw new Error(`Insumo ${item.insumoId} no encontrado.`);
      }
    });

    if (data.id) {
      const receta = this.findRecetaById(data.id);
      Object.assign(receta, data);
      return receta;
    }

    const nueva: Receta = {
      id: `REC-${randomUUID()}`,
      productoId: data.productoId,
      items: data.items,
      costoManoObra: data.costoManoObra
    };
    this.db.recipes.push(nueva);
    return nueva;
  }

  public listarProductos(): Producto[] {
    return this.db.products.map((producto) => ({ ...producto }));
  }

  public findProductById(id: string): Producto {
    const producto = this.db.products.find((item) => item.id === id);
    if (!producto) {
      throw new Error("Producto no encontrado.");
    }
    return producto;
  }

  public crearProducto(data: CreateProductInput): Producto {
    const nuevo: Producto = {
      id: `PRD-${randomUUID()}`,
      nombre: data.nombre.trim(),
      stockDisponible: data.stockDisponible ?? 0,
      precioUnitario: data.precioUnitario,
      precioVenta: data.precioVenta
    };
    this.db.products.push(nuevo);
    return nuevo;
  }

  public actualizarProducto(id: string, data: UpdateProductInput): Producto {
    const producto = this.findProductById(id);
    Object.assign(producto, data);
    return producto;
  }

  public eliminarProducto(id: string): void {
    const index = this.db.products.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error("Producto no encontrado.");
    }
    this.db.products.splice(index, 1);
    for (let i = this.db.recipes.length - 1; i >= 0; i--) {
      if (this.db.recipes[i].productoId === id) {
        this.db.recipes.splice(i, 1);
      }
    }
  }

  public registrarProduccion(recetaId: string, cantidadProducida: number) {
    if (cantidadProducida <= 0) {
      throw new Error("La cantidad producida debe ser mayor a cero.");
    }

    const receta = this.findRecetaById(recetaId);

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

    const producto = this.findProductById(receta.productoId);

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
