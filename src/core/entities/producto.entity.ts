import type { Identifiable } from "./common";

export interface Producto extends Identifiable {
  nombre: string;
  stockDisponible: number;
  precioUnitario?: number;
  precioVenta?: number;
}
