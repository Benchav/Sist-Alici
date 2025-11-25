import type { Identifiable } from "./common";

export enum Role {
  ADMIN = "ADMIN",
  PANADERO = "PANADERO",
  CAJERO = "CAJERO"
}

export interface Usuario extends Identifiable {
  username: string;
  nombre: string;
  rol: Role;
  passwordHash: string;
}
