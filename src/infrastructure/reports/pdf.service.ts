import PDFDocument from "pdfkit";
import type { Venta } from "../../core/entities/venta.entity";
import { getTursoClient } from "../database/turso";

export class PdfService {
  private readonly client = getTursoClient();

  public async generarFactura(venta: Venta): Promise<Buffer> {
    const nombres = await this.obtenerNombresProductos(venta);

    return await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      doc.fontSize(18).text("Panadería Alici", { align: "center" });
      doc.moveDown();
      doc.fontSize(12).text(`Fecha: ${new Date(venta.fecha ?? Date.now()).toLocaleString("es-NI")}`);
      doc.text(`ID Venta: ${venta.id}`);
      doc.moveDown();

      doc.fontSize(14).text("Detalle de Ítems");
      doc.moveDown(0.5);
      venta.items.forEach((item) => {
        const nombre = nombres.get(item.productoId) ?? item.productoId;
        doc.fontSize(12).text(`${nombre}  | Cant: ${item.cantidad} x C$${item.precioUnitario.toFixed(2)}`);
      });

      doc.moveDown();
      doc.fontSize(14).text(`Total (C$): ${venta.totalNIO.toFixed(2)}`);
      doc.moveDown();

      doc.fontSize(14).text("Pagos");
      venta.pagos.forEach((pago) => {
        doc
          .fontSize(12)
          .text(
            `Moneda: ${pago.moneda}  | Monto: ${pago.cantidad.toFixed(2)}${
              pago.tasa ? `  | Tasa: ${pago.tasa.toFixed(2)}` : ""
            }`
          );
      });

      doc.moveDown(2);
      doc.fontSize(10).text("Documento generado por SIST-ALICI ERP", { align: "center" });
      doc.end();
    });
  }

  private async obtenerNombresProductos(venta: Venta): Promise<Map<string, string>> {
    const ids = Array.from(new Set(venta.items.map((item) => item.productoId)));
    const map = new Map<string, string>();

    if (!ids.length) {
      return map;
    }

    const placeholders = ids.map(() => "?").join(",");
    const { rows } = await this.client.execute({
      sql: `SELECT id, nombre FROM productos WHERE id IN (${placeholders})`,
      args: ids
    });

    rows.forEach((row) => {
      map.set(String(row.id), String(row.nombre));
    });

    return map;
  }
}
