import "dotenv/config";
import type { Categoria } from "../core/entities/categoria.entity";
import type { Insumo } from "../core/entities/insumo.entity";
import type { Producto } from "../core/entities/producto.entity";
import type { Proveedor } from "../core/entities/proveedor.entity";
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

async function seedCategorias(token: string): Promise<Categoria[]> {
  const fixtures: Array<Pick<Categoria, "nombre" | "tipo">> = [
    { nombre: `Línea Producción ${RUN_SUFFIX}`, tipo: "PRODUCCION" },
    { nombre: `Reventa Gourmet ${RUN_SUFFIX}`, tipo: "REVENTA" },
    { nombre: `Insumos Base ${RUN_SUFFIX}`, tipo: "INSUMO" }
  ];

  const created: Categoria[] = [];
  console.log(`Creando ${fixtures.length} categorías...`);
  for (const categoria of fixtures) {
    const response = await callApi<ApiResponse<Categoria>>("/inventory/categories", {
      method: "POST",
      token,
      body: categoria
    });
    created.push(response.data);
    console.log(`  • Categoría ${response.data.nombre} (${response.data.tipo})`);
    await delay(50);
  }
  return created;
}

async function seedProveedores(token: string): Promise<Proveedor[]> {
  const fixtures: Array<Pick<Proveedor, "nombre" | "frecuenciaCredito" | "contacto">> = [
    {
      nombre: `Harinas Selectas ${RUN_SUFFIX}`,
      frecuenciaCredito: "30D",
      contacto: "harinas@suministros.test"
    },
    {
      nombre: `Lácteos Premium ${RUN_SUFFIX}`,
      frecuenciaCredito: "15D",
      contacto: "lacteos@suministros.test"
    },
    {
      nombre: `Dulces Centro ${RUN_SUFFIX}`,
      frecuenciaCredito: "45D",
      contacto: "dulces@suministros.test"
    }
  ];

  const created: Proveedor[] = [];
  console.log(`Creando ${fixtures.length} proveedores...`);
  for (const proveedor of fixtures) {
    const response = await callApi<ApiResponse<Proveedor>>("/inventory/providers", {
      method: "POST",
      token,
      body: proveedor
    });
    created.push(response.data);
    console.log(`  • Proveedor ${response.data.nombre}`);
    await delay(50);
  }
  return created;
}

async function seedInsumos(token: string, proveedores: Proveedor[]): Promise<Insumo[]> {
  if (!proveedores.length) {
    throw new Error("Se requiere al menos un proveedor para registrar insumos.");
  }

  const insumoFixtures: Array<Pick<Insumo, "nombre" | "unidad" | "stock" | "costoPromedio">> = [
    { nombre: "Harina Suprema", unidad: "kg", stock: 500, costoPromedio: 32.5 },
    { nombre: "Azúcar Morena", unidad: "kg", stock: 320, costoPromedio: 27.8 },
    { nombre: "Levadura Dorada", unidad: "kg", stock: 120, costoPromedio: 95.4 },
    { nombre: "Huevos de Campo", unidad: "caja", stock: 90, costoPromedio: 210.35 },
    { nombre: "Leche Entera Pasteurizada", unidad: "lt", stock: 260, costoPromedio: 28.15 }
  ];

  const created: Insumo[] = [];
  console.log(`Creando ${insumoFixtures.length} insumos...`);
  for (let index = 0; index < insumoFixtures.length; index++) {
    const insumo = insumoFixtures[index];
    const proveedor = proveedores[index % proveedores.length];
    const response = await callApi<ApiResponse<Insumo>>("/inventory", {
      method: "POST",
      token,
      body: { ...insumo, proveedorPrincipalId: proveedor.id }
    });
    created.push(response.data);
    console.log(`  • Insumo ${response.data.nombre}`);
    await delay(50);
  }
  return created;
}

async function seedProductos(token: string, categorias: Categoria[]): Promise<Producto[]> {
  const categoriaProduccion = categorias.find((cat) => cat.tipo === "PRODUCCION");
  if (!categoriaProduccion) {
    throw new Error("Se requiere una categoría de PRODUCCION para los productos base.");
  }

  const productoFixtures: Array<
    Pick<Producto, "nombre" | "stockDisponible" | "precioUnitario" | "precioVenta" | "categoriaId">
  > = [
    {
      nombre: `Pan Brioche ${RUN_SUFFIX}`,
      stockDisponible: 0,
      precioUnitario: 38,
      precioVenta: 60,
      categoriaId: categoriaProduccion.id
    },
    {
      nombre: `Baguette Mediterránea ${RUN_SUFFIX}`,
      stockDisponible: 0,
      precioUnitario: 42,
      precioVenta: 68,
      categoriaId: categoriaProduccion.id
    },
    {
      nombre: `Croissant Mantequilla ${RUN_SUFFIX}`,
      stockDisponible: 0,
      precioUnitario: 55,
      precioVenta: 85,
      categoriaId: categoriaProduccion.id
    },
    {
      nombre: `Pastel Cacao Intenso ${RUN_SUFFIX}`,
      stockDisponible: 0,
      precioUnitario: 180,
      precioVenta: 260,
      categoriaId: categoriaProduccion.id
    },
    {
      nombre: `Pan Integral Semillas ${RUN_SUFFIX}`,
      stockDisponible: 0,
      precioUnitario: 45,
      precioVenta: 70,
      categoriaId: categoriaProduccion.id
    }
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

async function seedProductosReventa(token: string, categorias: Categoria[]): Promise<Producto[]> {
  const categoriaReventa = categorias.find((cat) => cat.tipo === "REVENTA");
  if (!categoriaReventa) {
    throw new Error("Se requiere una categoría de REVENTA para los productos de reventa.");
  }

  const fixtures: Array<
    Pick<Producto, "nombre" | "stockDisponible" | "precioUnitario" | "precioVenta" | "categoriaId">
  > = [
    {
      nombre: `Queso Curado ${RUN_SUFFIX}`,
      stockDisponible: 0,
      precioUnitario: 210,
      precioVenta: 320,
      categoriaId: categoriaReventa.id
    },
    {
      nombre: `Café Tostado ${RUN_SUFFIX}`,
      stockDisponible: 0,
      precioUnitario: 185,
      precioVenta: 290,
      categoriaId: categoriaReventa.id
    }
  ];

  const created: Producto[] = [];
  console.log(`Creando ${fixtures.length} productos de reventa...`);
  for (const producto of fixtures) {
    const response = await callApi<ApiResponse<Producto>>("/production/products", {
      method: "POST",
      token,
      body: producto
    });
    created.push(response.data);
    console.log(`  • Producto de reventa ${response.data.nombre}`);
    await delay(50);
  }
  return created;
}

async function seedProduccionDiaria(token: string, productos: Producto[], insumos: Insumo[]): Promise<void> {
  if (!productos.length) {
    return;
  }

  const insumoMap = new Map(insumos.map((insumo) => [insumo.nombre, insumo]));
  const productoMap = new Map(productos.map((producto) => [producto.nombre, producto]));

  const templates = [
    {
      productoNombre: productos[0].nombre,
      costoManoObra: 140,
      items: [
        { insumoNombre: "Harina Suprema", cantidad: 1.2 },
        { insumoNombre: "Leche Entera Pasteurizada", cantidad: 0.6 },
        { insumoNombre: "Huevos de Campo", cantidad: 0.3 }
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
        { insumoNombre: "Levadura Dorada", cantidad: 0.05 },
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
      costoManoObra: 135,
      items: [
        { insumoNombre: "Harina Suprema", cantidad: 1.3 },
        { insumoNombre: "Levadura Dorada", cantidad: 0.04 },
        { insumoNombre: "Azúcar Morena", cantidad: 0.3 }
      ]
    }
  ];

  const lotes = [15, 18, 22, 20, 25];
  const payload = templates.map((template, index) => {
    const producto = productoMap.get(template.productoNombre);
    if (!producto) {
      throw new Error(`Producto ${template.productoNombre} no encontrado para producción.`);
    }
    const cantidadProducida = lotes[index % lotes.length];
    const factor = Math.max(1, cantidadProducida / 10);
    const insumosConsumidos = template.items.map((item) => {
      const insumo = insumoMap.get(item.insumoNombre);
      if (!insumo) {
        throw new Error(`Insumo ${item.insumoNombre} no encontrado para producción.`);
      }
      return {
        insumoId: insumo.id,
        cantidad: Number((item.cantidad * factor).toFixed(2))
      };
    });

    return {
      productoId: producto.id,
      cantidadProducida,
      costoManoObra: template.costoManoObra,
      insumos: insumosConsumidos
    };
  });

  console.log("Registrando producción diaria por volumen...");
  await callApi<ApiResponse<unknown>>("/production/daily", {
    method: "POST",
    token,
    body: payload
  });
  console.log(`  • ${payload.length} lotes diarios registrados`);
}

async function seedComprasReventa(token: string, productos: Producto[]): Promise<void> {
  if (!productos.length) {
    return;
  }

  console.log("Registrando compras de productos para reventa...");
  for (let index = 0; index < productos.length; index++) {
    const producto = productos[index];
    const cantidad = 24 + index * 8;
    const costoUnitario = producto.precioUnitario ?? producto.precioVenta ?? 150;
    const costoTotal = Number((costoUnitario * cantidad * 0.85).toFixed(2));

    await callApi<ApiResponse<Producto>>("/inventory/purchase/finished", {
      method: "POST",
      token,
      body: {
        productoId: producto.id,
        cantidad,
        costoTotal
      }
    });

    console.log(`  • Compra registrada para ${producto.nombre} (${cantidad} uds)`);
    await delay(50);
  }
}

async function fetchProductos(token: string, nombres?: string[]): Promise<Producto[]> {
  const response = await callApi<ApiResponse<Producto[]>>("/production/products", {
    method: "GET",
    token
  });

  let filtered: Producto[];
  if (nombres?.length) {
    const allowed = new Set(nombres);
    filtered = response.data.filter((producto) => allowed.has(producto.nombre));
  } else {
    filtered = response.data.filter((producto) => producto.nombre.includes(RUN_SUFFIX));
  }

  if (!filtered.length) {
    throw new Error("No se encontraron productos coincidentes con esta ejecución.");
  }

  return filtered;
}

async function seedVentas(token: string, productosBase: Producto[]): Promise<Venta[]> {
  if (productosBase.length < 5) {
    throw new Error("Se requieren al menos 5 productos base para registrar ventas.");
  }

  const nombresObjetivo = productosBase.map((producto) => producto.nombre);
  const productos = await fetchProductos(token, nombresObjetivo);
  const ordered = nombresObjetivo.map((nombre) => {
    const encontrado = productos.find((prod) => prod.nombre === nombre);
    if (!encontrado) {
      throw new Error(`Producto ${nombre} no está disponible para ventas.`);
    }
    return encontrado;
  });

  const productMap = new Map(ordered.map((prod) => [prod.nombre, prod]));
  const [productoA, productoB, productoC, productoD, productoE] = ordered;

  const templates = [
    {
      items: [
        { nombre: productoA.nombre, cantidad: 5 },
        { nombre: productoD.nombre, cantidad: 3 }
      ],
      pagos: [
        { moneda: "NIO" as const, coverage: 1.1 }
      ]
    },
    {
      items: [
        { nombre: productoB.nombre, cantidad: 6 }
      ],
      pagos: [
        { moneda: "USD" as const, coverage: 1.2, tasa: DEFAULT_TASA_CAMBIO }
      ]
    },
    {
      items: [
        { nombre: productoC.nombre, cantidad: 8 }
      ],
      pagos: [
        { moneda: "NIO" as const, coverage: 0.6 },
        { moneda: "USD" as const, coverage: 0.7, tasa: DEFAULT_TASA_CAMBIO + 0.15 }
      ]
    },
    {
      items: [
        { nombre: productoE.nombre, cantidad: 10 }
      ],
      pagos: [
        { moneda: "NIO" as const, coverage: 1.05 }
      ]
    },
    {
      items: [
        { nombre: productoA.nombre, cantidad: 7 },
        { nombre: productoC.nombre, cantidad: 4 }
      ],
      pagos: [
        { moneda: "USD" as const, coverage: 0.8, tasa: DEFAULT_TASA_CAMBIO },
        { moneda: "NIO" as const, coverage: 0.5 }
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
    const categorias = await seedCategorias(token);
    const proveedores = await seedProveedores(token);
    const insumos = await seedInsumos(token, proveedores);
    const productosProduccion = await seedProductos(token, categorias);
    const productosReventa = await seedProductosReventa(token, categorias);
    await seedProduccionDiaria(token, productosProduccion, insumos);
    await seedComprasReventa(token, productosReventa);
    await seedVentas(token, productosProduccion);
    console.log("\nSemillas API completadas correctamente.");
  } catch (error) {
    console.error("Error durante el proceso de sembrado:", error);
    process.exitCode = 1;
  }
}

void main();


// Note: This script seeds the API with initial data including users, insumos, productos, producción diaria y ventas.
// correr npm run seed:api