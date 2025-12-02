import type { Identifiable } from "./common";

export interface RecetaItem {
  insumoId: string;
  cantidad: number;
}

export interface Receta extends Identifiable {
  productoId: string;
  items: RecetaItem[];
  costoManoObra?: number;
  rendimientoBase: number;
}
