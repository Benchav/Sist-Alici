import "dotenv/config";
import type { Insumo } from "../core/entities/insumo.entity";
import type { Producto } from "../core/entities/producto.entity";
import type { Receta } from "../core/entities/receta.entity";
import type { DetallePago, Venta } from "../core/entities/venta.entity";
import { Role, type Usuario } from "../core/entities/usuario.entity";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3000/api";
const ADMIN_USERNAME = process.env.SEED_ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "123456";
const DEFAULT_TASA_CAMBIO = Number(process.env.TASA_CAMBIO_BASE ?? "36.6");
const RUN_SUFFIX = process.env.SEED_RUN_SUFFIX ?? Math.random().toString(36).slice(2, 8);

interface ApiResponse<T> {
  data: T;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const buildHeaders = (token?: string, hasBody?: boolean): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (hasBody) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
};

async function callApi<T>(
  path: string,
  { method = "GET", body, token }: { method?: string; body?: unknown; token?: string }
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: buildHeaders(token, body !== undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error ${response.status} ${response.statusText} en ${path}: ${errorText}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  const text = await response.text();
  if (!text.length) {
    return {} as T;
  }

  return JSON.parse(text) as T;
}

async function authenticate(): Promise<string> {
  console.log(`Autenticando como ${ADMIN_USERNAME}...`);
  const result = await callApi<{ token: string }>("/auth/login", {
    method: "POST",
    body: {
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD
    }
  });
  console.log("✓ Token obtenido");
  return result.token;
}

async function seedUsers(token: string): Promise<Usuario[]> {
  const userFixtures: Array<Omit<Usuario, "id" | "passwordHash"> & { password: string }> = [
    { username: `panadero_${RUN_SUFFIX}_01`, nombre: "Luis Obrero", rol: Role.PANADERO, password: "P4n@123" },
    { username: `panadero_${RUN_SUFFIX}_02`, nombre: "Maria Amasijo", rol: Role.PANADERO, password: "P4n@123" },
    { username: `cajero_${RUN_SUFFIX}_01`, nombre: "Ana Cobros", rol: Role.CAJERO, password: "C4j@123" },
    { username: `cajero_${RUN_SUFFIX}_02`, nombre: "Pedro Caja", rol: Role.CAJERO, password: "C4j@123" },
    { username: `admin_${RUN_SUFFIX}_01`, nombre: "Lucia Control", rol: Role.ADMIN, password: "Adm1n#123" },
    { username: `admin_${RUN_SUFFIX}_02`, nombre: "Carlos Supervisor", rol: Role.ADMIN, password: "Adm1n#123" }
  ];

  const created: Usuario[] = [];
  console.log(`Creando ${userFixtures.length} usuarios adicionales...`);
  for (const user of userFixtures) {
    const response = await callApi<ApiResponse<Usuario>>("/auth/register", {
      method: "POST",
      token,
      body: user
    });
    created.push(response.data);
    console.log(`  • Usuario ${response.data.username}`);
    await delay(50);
  }
  return created;
}

async function seedInsumos(token: string): Promise<Insumo[]> {
  const insumoFixtures: Array<Pick<Insumo, "nombre" | "unidad" | "stock" | "costoPromedio">> = [
    { nombre: "Harina Suprema", unidad: "kg", stock: 500, costoPromedio: 32.5 },
    { nombre: "Azúcar Morena", unidad: "kg", stock: 320, costoPromedio: 27.8 },
    { nombre: "Levadura Dorada", unidad: "kg", stock: 120, costoPromedio: 95.4 },
    { nombre: "Mantequilla Artesanal", unidad: "kg", stock: 140, costoPromedio: 110.0 },
    { nombre: "Huevos de Campo", unidad: "caja", stock: 90, costoPromedio: 210.35 },
    { nombre: "Leche Entera Pasteurizada", unidad: "lt", stock: 260, costoPromedio: 28.15 }
  ];

  const created: Insumo[] = [];
  console.log(`Creando ${insumoFixtures.length} insumos...`);
  for (const insumo of insumoFixtures) {
    const response = await callApi<ApiResponse<Insumo>>("/inventory", {
      method: "POST",
      token,
      body: insumo
    });
    created.push(response.data);
    console.log(`  • Insumo ${response.data.nombre}`);
    await delay(50);
  }
  return created;
}

async function seedProductos(token: string): Promise<Producto[]> {
  const productoFixtures: Array<Pick<Producto, "nombre" | "stockDisponible" | "precioUnitario" | "precioVenta">> = [
    { nombre: `Pan Brioche ${RUN_SUFFIX}`, stockDisponible: 0, precioUnitario: 38, precioVenta: 60 },
    { nombre: `Baguette Mediterránea ${RUN_SUFFIX}`, stockDisponible: 0, precioUnitario: 42, precioVenta: 68 },
    { nombre: `Croissant Mantequilla ${RUN_SUFFIX}`, stockDisponible: 0, precioUnitario: 55, precioVenta: 85 },
    { nombre: `Pastel Cacao Intenso ${RUN_SUFFIX}`, stockDisponible: 0, precioUnitario: 180, precioVenta: 260 },
    { nombre: `Galleta Avena Chips ${RUN_SUFFIX}`, stockDisponible: 0, precioUnitario: 25, precioVenta: 40 },
    { nombre: `Pan Integral Semillas ${RUN_SUFFIX}`, stockDisponible: 0, precioUnitario: 45, precioVenta: 70 }
  ];

  const created: Producto[] = [];
  console.log(`Creando ${productoFixtures.length} productos...`);
  for (const producto of productoFixtures) {
    const response = await callApi<ApiResponse<Producto>>("/production/products", {
      method: "POST",
      token,
      body: producto
    });
    created.push(response.data);
    console.log(`  • Producto ${response.data.nombre}`);
    await delay(50);
  }
  return created;
}

async function seedRecetas(token: string, productos: Producto[], insumos: Insumo[]): Promise<Receta[]> {
  const insumoMap = new Map(insumos.map((insumo) => [insumo.nombre, insumo]));
  const productoMap = new Map(productos.map((producto) => [producto.nombre, producto]));

  const recetaTemplates = [
    {
      productoNombre: productos[0].nombre,
      costoManoObra: 140,
      items: [
        { insumoNombre: "Harina Suprema", cantidad: 1.2 },
        { insumoNombre: "Mantequilla Artesanal", cantidad: 0.4 },
        { insumoNombre: "Leche Entera Pasteurizada", cantidad: 0.6 }
      ]
    },
    {
      productoNombre: productos[1].nombre,
      costoManoObra: 120,
      items: [
        { insumoNombre: "Harina Suprema", cantidad: 1.5 },
        { insumoNombre: "Levadura Dorada", cantidad: 0.05 },
        { insumoNombre: "Leche Entera Pasteurizada", cantidad: 0.4 }
      ]
    },
    {
      productoNombre: productos[2].nombre,
      costoManoObra: 180,
      items: [
        { insumoNombre: "Harina Suprema", cantidad: 1.1 },
        { insumoNombre: "Mantequilla Artesanal", cantidad: 0.5 },
        { insumoNombre: "Huevos de Campo", cantidad: 0.4 }
      ]
    },
    {
      productoNombre: productos[3].nombre,
      costoManoObra: 250,
      items: [
        { insumoNombre: "Harina Suprema", cantidad: 0.8 },
        { insumoNombre: "Azúcar Morena", cantidad: 0.7 },
        { insumoNombre: "Huevos de Campo", cantidad: 0.6 },
        { insumoNombre: "Leche Entera Pasteurizada", cantidad: 0.9 }
      ]
    },
    {
      productoNombre: productos[4].nombre,
      costoManoObra: 90,
      items: [
        { insumoNombre: "Harina Suprema", cantidad: 0.6 },
        { insumoNombre: "Azúcar Morena", cantidad: 0.4 },
        { insumoNombre: "Leche Entera Pasteurizada", cantidad: 0.2 }
      ]
    },
    {
      productoNombre: productos[5].nombre,
      costoManoObra: 135,
      items: [
        { insumoNombre: "Harina Suprema", cantidad: 1.3 },
        { insumoNombre: "Levadura Dorada", cantidad: 0.04 },
        { insumoNombre: "Azúcar Morena", cantidad: 0.3 }
      ]
    }
  ];

  const created: Receta[] = [];
  console.log(`Creando ${recetaTemplates.length} recetas...`);
  for (const template of recetaTemplates) {
    const producto = productoMap.get(template.productoNombre);
    if (!producto) {
      throw new Error(`Producto ${template.productoNombre} no encontrado para receta.`);
    }

    const items = template.items.map((item) => {
      const insumo = insumoMap.get(item.insumoNombre);
      if (!insumo) {
        throw new Error(`Insumo ${item.insumoNombre} no encontrado para receta.`);
      }
      return { insumoId: insumo.id, cantidad: item.cantidad };
    });

    const response = await callApi<ApiResponse<Receta>>("/production/recipes", {
      method: "POST",
      token,
      body: {
        productoId: producto.id,
        costoManoObra: template.costoManoObra,
        items
      }
    });

    created.push(response.data);
    console.log(`  • Receta ${response.data.id} para ${template.productoNombre}`);
    await delay(50);
  }

  return created;
}

async function seedProduccion(token: string, recetas: Receta[]): Promise<void> {
  const lotes = [15, 18, 22, 20, 30, 25];
  console.log("Registrando lotes de producción...");
  for (let i = 0; i < recetas.length; i++) {
    const receta = recetas[i];
    const cantidad = lotes[i % lotes.length];
    await callApi<ApiResponse<unknown>>("/production", {
      method: "POST",
      token,
      body: { recetaId: receta.id, cantidad }
    });
    console.log(`  • Producción registrada: receta ${receta.id} x ${cantidad}`);
    await delay(50);
  }
}

async function fetchProductos(token: string): Promise<Producto[]> {
  const response = await callApi<ApiResponse<Producto[]>>("/production/products", {
    method: "GET",
    token
  });
  return response.data;
}

async function seedVentas(token: string): Promise<Venta[]> {
  const productos = await fetchProductos(token);
  const productMap = new Map(productos.map((prod) => [prod.nombre, prod]));

  const templates = [
    {
      items: [
        { nombre: productos[0].nombre, cantidad: 5 },
        { nombre: productos[4].nombre, cantidad: 12 }
      ],
      pagos: [
        { moneda: "NIO" as const, coverage: 1.1 }
      ]
    },
    {
      items: [
        { nombre: productos[1].nombre, cantidad: 6 }
      ],
      pagos: [
        { moneda: "USD" as const, coverage: 1.2, tasa: DEFAULT_TASA_CAMBIO }
      ]
    },
    {
      items: [
        { nombre: productos[2].nombre, cantidad: 8 },
        { nombre: productos[3].nombre, cantidad: 3 }
      ],
      pagos: [
        { moneda: "NIO" as const, coverage: 0.6 },
        { moneda: "USD" as const, coverage: 0.7, tasa: DEFAULT_TASA_CAMBIO + 0.15 }
      ]
    },
    {
      items: [
        { nombre: productos[5].nombre, cantidad: 10 }
      ],
      pagos: [
        { moneda: "NIO" as const, coverage: 1.05 }
      ]
    },
    {
      items: [
        { nombre: productos[0].nombre, cantidad: 7 },
        { nombre: productos[2].nombre, cantidad: 4 }
      ],
      pagos: [
        { moneda: "USD" as const, coverage: 0.8, tasa: DEFAULT_TASA_CAMBIO },
        { moneda: "NIO" as const, coverage: 0.5 }
      ]
    },
    {
      items: [
        { nombre: productos[3].nombre, cantidad: 2 },
        { nombre: productos[4].nombre, cantidad: 15 }
      ],
      pagos: [
        { moneda: "NIO" as const, coverage: 1.15 }
      ]
    }
  ];

  const created: Venta[] = [];
  console.log("Registrando ventas de prueba...");
  for (const template of templates) {
    const items = template.items.map((item) => {
      const producto = productMap.get(item.nombre);
      if (!producto) {
        throw new Error(`Producto ${item.nombre} no disponible para ventas.`);
      }
      return { producto, cantidad: item.cantidad };
    });

    const total = items.reduce((acc, current) => {
      const price = current.producto.precioVenta ?? current.producto.precioUnitario;
      if (price === undefined) {
        throw new Error(`El producto ${current.producto.nombre} no tiene precio definido.`);
      }
      return acc + price * current.cantidad;
    }, 0);

    const pagos: DetallePago[] = template.pagos.map((pago) => {
      const baseAmount = total * pago.coverage;
      if (pago.moneda === "NIO") {
        return {
          moneda: "NIO",
          cantidad: Number(baseAmount.toFixed(2))
        };
      }
      const tasa = pago.tasa ?? DEFAULT_TASA_CAMBIO;
      return {
        moneda: "USD",
        tasa,
        cantidad: Number((baseAmount / tasa).toFixed(2))
      };
    });

    const payload = {
      items: items.map((item) => ({ productoId: item.producto.id, cantidad: item.cantidad })),
      pagos
    };

    const response = await callApi<{ data: Venta; cambio: number }>("/sales/checkout", {
      method: "POST",
      token,
      body: payload
    });

    created.push(response.data);
    console.log(
      `  • Venta ${response.data.id} total ${response.data.totalNIO.toFixed(2)} NIO (cambio ${response.cambio.toFixed(2)} NIO)`
    );
    await delay(50);
  }

  return created;
}

async function main(): Promise<void> {
  try {
    const token = await authenticate();
    await seedUsers(token);
    const insumos = await seedInsumos(token);
    const productos = await seedProductos(token);
    const recetas = await seedRecetas(token, productos, insumos);
    await seedProduccion(token, recetas);
    await seedVentas(token);
    console.log("\nSemillas API completadas correctamente.");
  } catch (error) {
    console.error("Error durante el proceso de sembrado:", error);
    process.exitCode = 1;
  }
}

void main();
