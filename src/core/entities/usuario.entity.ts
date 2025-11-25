import type { Identifiable } from "./common";

export type Role = "ADMIN" | "PANADERO" | "CAJERO";

export interface Usuario extends Identifiable {
  nombre: string;
  rol: Role;
}
