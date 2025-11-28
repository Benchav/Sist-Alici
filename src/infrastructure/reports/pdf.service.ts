import PDFDocument from "pdfkit";
import type { Venta } from "../../core/entities/venta.entity";
import { getTursoClient } from "../database/turso";

const baseCurrencyFormatter = new Intl.NumberFormat("es-NI", {
  style: "currency",
  currency: "NIO"
});

const formatCurrency = (value: number): string =>
  baseCurrencyFormatter.format(Number.isFinite(value) ? value : 0);

const formatCurrencyByCode = (value: number, currency: string): string => {
  const safeCurrency = typeof currency === "string" ? currency.toUpperCase() : "NIO";
  const targetCurrency = safeCurrency === "USD" ? "USD" : "NIO";
  return new Intl.NumberFormat("es-NI", {
    style: "currency",
    currency: targetCurrency
  }).format(Number.isFinite(value) ? value : 0);
};

type PdfDoc = InstanceType<typeof PDFDocument>;

export class PdfService {
  private readonly client = getTursoClient();

  public async generarFactura(venta: Venta): Promise<Buffer> {
    const nombres = await this.obtenerNombresProductos(venta);
    const subtotal = venta.items.reduce(
      (acc, item) => acc + item.precioUnitario * item.cantidad,
      0
    );
    const totalFactura = Number.isFinite(venta.totalNIO) ? venta.totalNIO : subtotal;

    return await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 48, size: "A4" });
      const buffers: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      this.drawHeader(doc);
      this.drawInvoiceMeta(doc, venta);
      this.drawItemsTable(doc, venta, nombres);
      this.drawTotalsSection(doc, subtotal, totalFactura);
      this.drawPaymentsSection(doc, venta);
      this.drawFooter(doc);

      doc.end();
    });
  }

  private drawHeader(doc: PdfDoc): void {
    const { left, right, top } = doc.page.margins;
    const width = doc.page.width - left - right;
    const blockHeight = 90;

    doc.save();
    doc.rect(left, top - 40, width, blockHeight).fill("#eef2ff");
    doc.fillColor("#4338ca").font("Helvetica-Bold").fontSize(24);
    doc.text("Panadería Alicia", left + 16, top - 20, {
      width: width / 2,
      align: "left"
    });
    doc.fontSize(10).font("Helvetica").fillColor("#4f46e5");
    doc.text("RUC 000-123456-789", left + 16, top + 14);
    doc.text("Tel. (505) 8929-3682", left + 16, top + 28);

    doc.font("Helvetica-Bold").fontSize(18).fillColor("#312e81");
    doc.text("Factura", left + width - 180, top - 20, {
      width: 160,
      align: "right"
    });
    doc.font("Helvetica").fontSize(10).fillColor("#312e81");
    doc.text("panaderiaalicia@gmail.com", left + width - 180, top + 10, {
      width: 160,
      align: "right"
    });
    doc.restore();

    doc.moveDown(2.5);
  }

  private drawInvoiceMeta(doc: PdfDoc, venta: Venta): void {
    const metaData = [
      {
        label: "Fecha",
        value: new Date(venta.fecha ?? Date.now()).toLocaleString("es-NI")
      },
      { label: "Factura", value: venta.id },
      { label: "Estado", value: venta.estado ?? "COMPLETA" },
      { label: "Atendido por", value: venta.usuarioId ?? "No especificado" }
    ];

    const { left, right } = doc.page.margins;
    const width = doc.page.width - left - right;
    const columnWidth = width / 2;
    const rowHeight = 36;
    const startY = doc.y;

    metaData.forEach((item, index) => {
      const columnIndex = index % 2;
      const rowIndex = Math.floor(index / 2);
      const x = left + columnIndex * columnWidth;
      const y = startY + rowIndex * rowHeight;

      doc.font("Helvetica-Bold").fontSize(10).fillColor("#94a3b8");
      doc.text(item.label.toUpperCase(), x, y);
      doc.font("Helvetica").fontSize(12).fillColor("#0f172a");
      doc.text(item.value, x, y + 14, { width: columnWidth - 10 });
    });

    const rowsUsed = Math.ceil(metaData.length / 2);
    doc.y = startY + rowsUsed * rowHeight + 10;
  }

  private drawItemsTable(
    doc: PdfDoc,
    venta: Venta,
    nombres: Map<string, string>
  ): void {
    const { left, right } = doc.page.margins;
    const width = doc.page.width - left - right;
    const columns = [
      { key: "producto", width: width * 0.45, align: "left" as const },
      { key: "cantidad", width: width * 0.15, align: "center" as const },
      { key: "precio", width: width * 0.2, align: "right" as const },
      { key: "subtotal", width: width * 0.2, align: "right" as const }
    ];

    doc.moveDown(1.5);
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#0f172a").text("Detalle de ítems", left, doc.y);
    const tableTop = doc.y + 12;

    doc.save();
    doc.fillColor("#475569").font("Helvetica-Bold").fontSize(10);
    let headerX = left;
    columns.forEach((column) => {
      const label =
        column.key === "producto"
          ? "Producto"
          : column.key === "cantidad"
            ? "Cantidad"
            : column.key === "precio"
              ? "P. Unitario"
              : "Subtotal";
      doc.text(label.toUpperCase(), headerX, tableTop, {
        width: column.width,
        align: column.align
      });
      headerX += column.width;
    });
    doc.strokeColor("#e2e8f0").lineWidth(1).moveTo(left, tableTop + 14).lineTo(left + width, tableTop + 14).stroke();
    doc.restore();

    let rowY = tableTop + 22;
    doc.font("Helvetica").fontSize(11).fillColor("#0f172a");
    venta.items.forEach((item) => {
      const nombre = nombres.get(item.productoId) ?? item.productoId;
      const subtotal = item.precioUnitario * item.cantidad;
      let cellX = left;

      const cells = [
        nombre,
        item.cantidad.toString(),
        formatCurrency(item.precioUnitario),
        formatCurrency(subtotal)
      ];

      cells.forEach((value, index) => {
        doc.text(value, cellX, rowY, {
          width: columns[index].width,
          align: columns[index].align
        });
        cellX += columns[index].width;
      });

      doc.strokeColor("#f1f5f9").lineWidth(0.5).moveTo(left, rowY + 16).lineTo(left + width, rowY + 16).stroke();
      rowY += 22;
    });

    doc.y = rowY + 4;
  }

  private drawTotalsSection(doc: PdfDoc, subtotal: number, total: number): void {
    const { left, right } = doc.page.margins;
    const sectionWidth = 240;
    const labelX = doc.page.width - right - sectionWidth;
    const startY = doc.y + 10;
    const rows = [
      { label: "Subtotal", value: formatCurrency(subtotal), bold: false },
      { label: "Total factura", value: formatCurrency(total), bold: true }
    ];

    rows.forEach((row, index) => {
      const y = startY + index * 18;
      doc.font(row.bold ? "Helvetica-Bold" : "Helvetica").fontSize(11).fillColor("#475569");
      doc.text(row.label, labelX, y, { width: sectionWidth / 2 });
      doc.font(row.bold ? "Helvetica-Bold" : "Helvetica").fillColor("#0f172a");
      doc.text(row.value, labelX + sectionWidth / 2, y, {
        width: sectionWidth / 2,
        align: "right"
      });
    });

    doc.y = startY + rows.length * 18 + 10;
  }

  private drawPaymentsSection(doc: PdfDoc, venta: Venta): void {
    const pagos = venta.pagos ?? [];
    doc.moveDown(1);
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#0f172a").text("Pagos registrados");
    doc.moveDown(0.5);

    if (!pagos.length) {
      doc.font("Helvetica").fontSize(11).fillColor("#94a3b8").text("No se registraron pagos para esta venta.");
      return;
    }

    pagos.forEach((pago) => {
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#4338ca");
      doc.text(pago.moneda.toUpperCase(), { continued: true });
      doc.font("Helvetica").fontSize(11).fillColor("#0f172a");
      doc.text(
        `  •  ${formatCurrencyByCode(pago.cantidad, pago.moneda)}${
          pago.tasa ? `  (Tasa: ${pago.tasa.toFixed(2)})` : ""
        }`
      );
    });
  }

  private drawFooter(doc: PdfDoc): void {
    doc.moveDown(2);
    doc.strokeColor("#e2e8f0").lineWidth(1);
    const { left, right } = doc.page.margins;
    doc.moveTo(left, doc.y).lineTo(doc.page.width - right, doc.y).stroke();
    doc.moveDown(0.8);
    doc.font("Helvetica").fontSize(10).fillColor("#94a3b8");
    doc.text("Gracias por confiar en Panadería Alici. Este documento es válido sin firma ni sello.", {
      align: "center"
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
