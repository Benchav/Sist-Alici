import { randomUUID } from "node:crypto";
import { InMemoryDatabase } from "../../infrastructure/database/in-memory-db";
import type {
  Producto,
  SystemConfig,
  Venta,
  VentaItem,
  VentaPago
} from "../../core/entities/types";

export type DetallePago = VentaPago;

export class SalesService {
  private readonly db = InMemoryDatabase.getInstance();
  private readonly tasaCambioBase: number;

  constructor(config?: SystemConfig) {
    this.tasaCambioBase = config?.tasaCambio ?? 1;
  }

  public procesarVenta(
    items: { productoId: string; cantidad: number }[],
    pagos: DetallePago[]
  ): { venta: Venta; cambio: number } {
    if (!items.length) {
      throw new Error("Debe incluir al menos un producto en la venta.");
    }
    if (!pagos.length) {
      throw new Error("Debe registrar al menos un pago.");
    }

    const detalles = items.map((item) => {
      if (item.cantidad <= 0) {
        throw new Error("La cantidad vendida debe ser mayor a cero.");
      }

      const producto = this.db.products.find((prod) => prod.id === item.productoId) as Producto | undefined;
      if (!producto) {
        throw new Error(`Producto ${item.productoId} no encontrado.`);
      }

      if (producto.stockDisponible < item.cantidad) {
        throw new Error(`Stock insuficiente para el producto ${producto.nombre}.`);
      }

      const precioUnitario = producto.precioVenta ?? producto.precioUnitario;
      if (precioUnitario === undefined) {
        throw new Error(`El producto ${producto.nombre} no tiene precio definido.`);
      }

      const subtotal = precioUnitario * item.cantidad;
      return { producto, cantidad: item.cantidad, precioUnitario, subtotal };
    });

    const totalVenta = detalles.reduce((acc, detalle) => acc + detalle.subtotal, 0);
    const totalPagado = pagos.reduce((acc, pago) => acc + this.convertirPagoANio(pago), 0);

    if (totalPagado + Number.EPSILON < totalVenta) {
      throw new Error("Pagos insuficientes para cubrir el total de la venta.");
    }

    detalles.forEach(({ producto, cantidad }) => {
      producto.stockDisponible -= cantidad;
    });

    const ventaItems: VentaItem[] = detalles.map((detalle) => ({
      productoId: detalle.producto.id,
      cantidad: detalle.cantidad,
      precioUnitario: detalle.precioUnitario
    }));

    const venta: Venta = {
      id: randomUUID(),
      totalNIO: Number(totalVenta.toFixed(2)),
      pagos,
      items: ventaItems,
      fecha: new Date().toISOString()
    };

    this.db.sales.push(venta);
    const cambio = Number((totalPagado - totalVenta).toFixed(2));

    return { venta, cambio };
  }

  private convertirPagoANio(pago: DetallePago): number {
    if (pago.cantidad <= 0) {
      throw new Error("Los pagos deben tener montos positivos.");
    }

    const moneda = pago.moneda.trim().toUpperCase();
    if (moneda === "USD") {
      const tasa = pago.tasa ?? this.tasaCambioBase;
      if (tasa <= 0) {
        throw new Error("La tasa de cambio debe ser mayor a cero.");
      }
      return pago.cantidad * tasa;
    }

    return pago.cantidad;
  }
}
