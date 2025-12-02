import type { Identifiable } from "./common";

export type EncargoEstado = "PENDIENTE" | "ENTREGADO" | "CANCELADO";

export interface EncargoItem extends Identifiable {
  encargoId: string;
  productoId: string;
  cantidad: number;
  precioEstimadoCents: number;
}

export interface EncargoAbono extends Identifiable {
  encargoId: string;
  montoCents: number;
  fecha: string;
  medioPago?: string;
}

export interface Encargo extends Identifiable {
  cliente: string;
  fechaEntrega: string;
  totalEstimadoCents: number;
  estado: EncargoEstado;
  ventaId?: string;
  createdAt?: string;
  items: EncargoItem[];
  abonos: EncargoAbono[];
}
