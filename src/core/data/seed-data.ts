import type { Categoria } from "../entities/categoria.entity";
import type { SystemConfig } from "../entities/config.entity";
import type { Insumo } from "../entities/insumo.entity";
import type { Producto } from "../entities/producto.entity";
import type { Proveedor } from "../entities/proveedor.entity";
import type { Receta } from "../entities/receta.entity";
import { Role, type Usuario } from "../entities/usuario.entity";
import type { Venta } from "../entities/venta.entity";

const DEFAULT_PASSWORD_HASH = "$2b$10$tSPWEkXQUh6GezwAOprsiOzUFoWqfpwImqr218onD6cT9zJwTg7Eq";

export const seedUsers: Usuario[] = [
  { id: "USR-ADMIN-0001", username: "admin", nombre: "Juan Gerente", rol: Role.ADMIN, passwordHash: DEFAULT_PASSWORD_HASH },
  { id: "USR-PAN-0001", username: "panadero", nombre: "Pedro Pan", rol: Role.PANADERO, passwordHash: DEFAULT_PASSWORD_HASH },
  { id: "USR-CAJ-0001", username: "cajero", nombre: "Ana Caja", rol: Role.CAJERO, passwordHash: DEFAULT_PASSWORD_HASH }
];

export const seedCategorias: Categoria[] = [
  { id: "CAT-PROD-0001", nombre: "Línea de Producción", tipo: "PRODUCCION" },
  { id: "CAT-REV-0001", nombre: "Reventa Gourmet", tipo: "REVENTA" },
  { id: "CAT-INS-0001", nombre: "Materias Primas", tipo: "INSUMO" }
];

export const seedProveedores: Proveedor[] = [
  { id: "PROV-HAR-0001", nombre: "Harinas Selectas", frecuenciaCredito: "30D", contacto: "ventas@harinas.test" },
  { id: "PROV-LAC-0001", nombre: "Lácteos Premium", frecuenciaCredito: "15D", contacto: "info@lacteos.test" },
  { id: "PROV-DUL-0001", nombre: "Dulces Centro", frecuenciaCredito: "45D", contacto: "pedidos@dulces.test" }
];

export const seedIngredients: Insumo[] = [
  {
    id: "INS-HAR-50KG",
    nombre: "Harina blanca (saco 50kg)",
    unidad: "saco",
    stock: 18,
    costoPromedio: 1325,
    proveedorPrincipalId: "PROV-HAR-0001"
  },
  {
    id: "INS-AZU-50KG",
    nombre: "Azúcar refinada (saco 50kg)",
    unidad: "saco",
    stock: 12,
    costoPromedio: 980,
    proveedorPrincipalId: "PROV-DUL-0001"
  },
  {
    id: "INS-HUE-CJA30",
    nombre: "Huevos AA (cajilla 30)",
    unidad: "cajilla",
    stock: 35,
    costoPromedio: 145,
    proveedorPrincipalId: "PROV-DUL-0001"
  },
  {
    id: "INS-LEC-LTR",
    nombre: "Leche fluida entera",
    unidad: "litro",
    stock: 80,
    costoPromedio: 32,
    proveedorPrincipalId: "PROV-LAC-0001"
  },
  {
    id: "INS-LEV-KG",
    nombre: "Levadura instantánea",
    unidad: "kilo",
    stock: 10,
    costoPromedio: 420,
    proveedorPrincipalId: "PROV-HAR-0001"
  }
];

export const seedProducts: Producto[] = [
  {
    id: "PRD-BAG-0001",
    nombre: "Pan Baguette",
    stockDisponible: 60,
    precioUnitario: 20,
    precioVenta: 25,
    categoriaId: "CAT-PROD-0001"
  },
  {
    id: "PRD-PCH-0001",
    nombre: "Pastel de Chocolate",
    stockDisponible: 12,
    precioUnitario: 360,
    precioVenta: 480,
    categoriaId: "CAT-PROD-0001"
  },
  {
    id: "PRD-PIC-0001",
    nombre: "Pico Dulce",
    stockDisponible: 90,
    precioUnitario: 12,
    precioVenta: 18,
    categoriaId: "CAT-PROD-0001"
  },
  {
    id: "PRD-REV-0001",
    nombre: "Café Tostado Especial",
    stockDisponible: 25,
    precioUnitario: 180,
    precioVenta: 260,
    categoriaId: "CAT-REV-0001"
  }
];

export const seedRecipes: Receta[] = [
  {
    id: "REC-BAG-0001",
    productoId: "PRD-BAG-0001",
    costoManoObra: 150,
    rendimientoBase: 40,
    items: [
      { insumoId: "INS-HAR-50KG", cantidad: 1.5 },
      { insumoId: "INS-LEV-KG", cantidad: 0.08 },
      { insumoId: "INS-LEC-LTR", cantidad: 2.5 }
    ]
  },
  {
    id: "REC-PCH-0001",
    productoId: "PRD-PCH-0001",
    costoManoObra: 220,
    rendimientoBase: 12,
    items: [
      { insumoId: "INS-HAR-50KG", cantidad: 1 },
      { insumoId: "INS-AZU-50KG", cantidad: 0.6 },
      { insumoId: "INS-HUE-CJA30", cantidad: 1.2 },
      { insumoId: "INS-LEC-LTR", cantidad: 3 }
    ]
  },
  {
    id: "REC-PIC-0001",
    productoId: "PRD-PIC-0001",
    costoManoObra: 90,
    rendimientoBase: 60,
    items: [
      { insumoId: "INS-HAR-50KG", cantidad: 0.7 },
      { insumoId: "INS-AZU-50KG", cantidad: 0.3 },
      { insumoId: "INS-LEV-KG", cantidad: 0.04 }
    ]
  }
];

export const seedSales: Venta[] = [];

export const seedConfig: SystemConfig = {
  tasaCambio: 36.6
};
