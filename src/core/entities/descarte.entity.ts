import type { Identifiable } from "./common";

export interface Descarte extends Identifiable {
  productoId: string;
  cantidad: number;
  motivo?: string;
  fecha: string;
}
