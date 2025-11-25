import type { Identifiable } from "./common";

export interface Insumo extends Identifiable {
  nombre: string;
  unidad: string;
  stock: number;
  costoPromedio: number;
}
