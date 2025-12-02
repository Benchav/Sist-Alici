import type { Identifiable } from "./common";

export type CategoriaTipo = "PRODUCCION" | "REVENTA" | "INSUMO";

export interface Categoria extends Identifiable {
  nombre: string;
  tipo: CategoriaTipo;
}
