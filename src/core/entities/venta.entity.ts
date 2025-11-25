import type { Identifiable } from "./common";

export interface DetallePago {
  moneda: string;
  cantidad: number;
  tasa?: number;
}

export interface VentaItem {
  productoId: string;
  cantidad: number;
  precioUnitario: number;
}

export interface Venta extends Identifiable {
  totalNIO: number;
  pagos: DetallePago[];
  items: VentaItem[];
  fecha?: string;
}
