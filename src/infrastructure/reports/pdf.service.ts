import PDFDocument from "pdfkit";
import type { Venta } from "../../core/entities/venta.entity";
import { InMemoryDatabase } from "../database/in-memory-db";

export class PdfService {
  private readonly db = InMemoryDatabase.getInstance();

  public async generarFactura(venta: Venta): Promise<Buffer> {
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
        const producto = this.db.products.find((prod) => prod.id === item.productoId);
        const nombre = producto?.nombre ?? item.productoId;
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
}
