import type { Identifiable } from "./common";

export interface Proveedor extends Identifiable {
  nombre: string;
  frecuenciaCredito?: string;
  contacto?: string;
}
