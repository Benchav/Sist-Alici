import "../src/config/env";

import { randomUUID } from "node:crypto";
import process from "node:process";
import { toCents } from "../src/core/utils/currency";
import { getTursoClient, withTursoTransaction } from "../src/infrastructure/database/turso";

type VentaRow = {
  id: string;
  items_json?: string | null;
  pagos_json?: string | null;
  estado?: string | null;
};

type VentaItemLegacy = {
  productoId: string;
  cantidad: number;
  precioUnitario: number;
};

type VentaPagoLegacy = {
  moneda: string;
  cantidad: number;
  tasa?: number;
};

export const normalizeVentas = async (options: { force?: boolean } = {}): Promise<void> => {
  if (process.env.NODE_ENV === "production" && !options.force) {
    throw new Error("normalize-ventas: use --force in production environments.");
  }

  const client = getTursoClient();
  const { rows } = await client.execute({
    sql: `SELECT id, items AS items_json, pagos AS pagos_json, estado
          FROM ventas`
  });

  if (!rows.length) {
    console.log("No hay ventas para normalizar.");
    return;
  }

  const ventas: VentaRow[] = rows.map((row) => ({
    id: String(row.id),
    items_json: typeof row.items_json === "string" ? row.items_json : null,
    pagos_json: typeof row.pagos_json === "string" ? row.pagos_json : null,
    estado: typeof row.estado === "string" ? row.estado : null
  }));

  for (const venta of ventas) {
    await normalizeVenta(venta, client);
  }
};

const normalizeVenta = async (row: VentaRow, client = getTursoClient()): Promise<void> => {
  const ventaId = String(row.id);
  const itemsSource = row.items_json ?? "[]";
  const pagosSource = row.pagos_json ?? "[]";

  let items: VentaItemLegacy[];
  let pagos: VentaPagoLegacy[];

  try {
    items = parseArray<VentaItemLegacy>(itemsSource, `${ventaId} items`);
    pagos = parseArray<VentaPagoLegacy>(pagosSource, `${ventaId} pagos`);
  } catch (error) {
    console.error(`Venta ${ventaId} tiene JSON inválido:`, error);
    await client.execute({
      sql: "UPDATE ventas SET estado = ? WHERE id = ?",
      args: ["PARSE_ERROR", ventaId]
    });
    return;
  }

  try {
    await withTursoTransaction(async (tx) => {
      await tx.execute({ sql: "DELETE FROM venta_items WHERE venta_id = ?", args: [ventaId] });
      await tx.execute({ sql: "DELETE FROM venta_pagos WHERE venta_id = ?", args: [ventaId] });

      for (const item of items) {
        validateItem(item, ventaId);
        const precioUnitarioCents = toCents(item.precioUnitario);
        const subtotalCents = Math.round(precioUnitarioCents * item.cantidad);
        await tx.execute({
          sql: `INSERT INTO venta_items
                (id, venta_id, producto_id, cantidad, precio_unitario_cents, subtotal_cents)
                VALUES (?, ?, ?, ?, ?, ?)` ,
          args: [
            randomUUID(),
            ventaId,
            item.productoId,
            item.cantidad,
            precioUnitarioCents,
            subtotalCents
          ]
        });
      }

      for (const pago of pagos) {
        validatePago(pago, ventaId);
        const moneda = pago.moneda.trim().toUpperCase();
        const cantidadCents = toCents(pago.cantidad);
        const tasa = pago.tasa ?? null;
        await tx.execute({
          sql: `INSERT INTO venta_pagos (id, venta_id, moneda, cantidad_cents, tasa)
                VALUES (?, ?, ?, ?, ?)` ,
          args: [randomUUID(), ventaId, moneda, cantidadCents, tasa]
        });
      }

      await tx.execute({
        sql: `UPDATE ventas
              SET estado = ?, items = ?, pagos = ?
              WHERE id = ?` ,
        args: ["NORMALIZED", JSON.stringify(items), JSON.stringify(pagos), ventaId]
      });
    }, client);

    console.log(`Venta ${ventaId} normalizada.`);
  } catch (error) {
    console.error(`Error normalizando venta ${ventaId}:`, error);
    await client.execute({
      sql: "UPDATE ventas SET estado = ? WHERE id = ?",
      args: ["PARSE_ERROR", ventaId]
    });
  }
};

const parseArray = <T>(value: string, label: string): T[] => {
  if (!value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error(`${label} no es un arreglo.`);
    }
    return parsed as T[];
  } catch (error) {
    throw new Error(`${label}: ${(error as Error).message}`);
  }
};

const validateItem = (item: VentaItemLegacy, ventaId: string): void => {
  if (!item?.productoId) {
    throw new Error(`Venta ${ventaId}: item sin productoId.`);
  }
  if (!Number.isFinite(item.cantidad) || item.cantidad <= 0) {
    throw new Error(`Venta ${ventaId}: item ${item.productoId} con cantidad inválida.`);
  }
  if (!Number.isFinite(item.precioUnitario)) {
    throw new Error(`Venta ${ventaId}: item ${item.productoId} sin precio.`);
  }
};

const validatePago = (pago: VentaPagoLegacy, ventaId: string): void => {
  if (!pago?.moneda) {
    throw new Error(`Venta ${ventaId}: pago sin moneda.`);
  }
  if (!Number.isFinite(pago.cantidad) || pago.cantidad <= 0) {
    throw new Error(`Venta ${ventaId}: pago en ${pago.moneda} inválido.`);
  }
};

const runFromCli = async (): Promise<void> => {
  const force = process.argv.includes("--force");
  try {
    await normalizeVentas({ force });
    console.log("Normalización finalizada.");
    process.exit(0);
  } catch (error) {
    console.error("Error al normalizar ventas:", error);
    process.exit(1);
  }
};

if (require.main === module) {
  void runFromCli();
}
