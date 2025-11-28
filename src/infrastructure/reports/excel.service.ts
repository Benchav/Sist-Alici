import ExcelJS, { type Row, type Worksheet } from "exceljs";
import type { Venta } from "../../core/entities/venta.entity";
import { getTursoClient } from "../database/turso";

const CURRENCY_FORMAT = "\"C$\" #,##0.00";

export class ExcelService {
  private readonly client = getTursoClient();

  public async generarReporteVentas(ventas: Venta[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.created = new Date();
    const sheet = workbook.addWorksheet("Reporte de Ventas", {
      views: [{ showGridLines: false }]
    });

    this.configureColumns(sheet);
    this.renderReportHeader(sheet);

    const nombresProductos = await this.obtenerNombresProductos(ventas);

    this.renderResumenSection(sheet, ventas);
    this.renderItemsSection(sheet, ventas, nombresProductos);
    this.renderPagosSection(sheet, ventas);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  }

  private configureColumns(sheet: Worksheet): void {
    sheet.columns = Array.from({ length: 9 }, () => ({ width: 20 }));
    sheet.getColumn(1).width = 26;
    sheet.getColumn(2).width = 22;
    sheet.getColumn(3).width = 18;
    sheet.getColumn(4).width = 18;
    sheet.getColumn(5).width = 18;
    sheet.getColumn(6).width = 18;
    sheet.getColumn(7).width = 18;
  }

  private renderReportHeader(sheet: Worksheet): void {
    sheet.mergeCells("A1:G1");
    const title = sheet.getCell("A1");
    title.value = "Panadería Alici · Reporte de Ventas";
    title.font = { name: "Calibri", size: 18, bold: true, color: { argb: "FF1D4ED8" } };
    title.alignment = { horizontal: "left", vertical: "middle" };
    sheet.getRow(1).height = 32;

    sheet.mergeCells("A2:G2");
    const subtitle = sheet.getCell("A2");
    subtitle.value = `Generado: ${new Date().toLocaleString("es-NI")}`;
    subtitle.font = { name: "Calibri", size: 11, color: { argb: "FF475569" } };
    subtitle.alignment = { horizontal: "left" };

    sheet.mergeCells("A3:G3");
    const note = sheet.getCell("A3");
    note.value = "Documento interno — Panel ERP Sist-Alici";
    note.font = { name: "Calibri", size: 10, color: { argb: "FF94A3B8" } };
    note.alignment = { horizontal: "left" };

    sheet.addRow([]);
  }

  private renderResumenSection(sheet: Worksheet, ventas: Venta[]): void {
    this.addSectionTitle(sheet, "Resumen de ventas");

    const headerRow = sheet.addRow(["ID", "Fecha", "Total Venta (C$)", "Pagado (C$)", "Cambio (C$)"]); 
    this.styleTableHeader(headerRow);

    if (!ventas.length) {
      const emptyRow = sheet.addRow(["Sin registros", "", "", "", ""]);
      this.styleEmptyRow(emptyRow);
      sheet.addRow([]);
      return;
    }

    ventas.forEach((venta) => {
      const totalPagado = this.calcularPagadoCordobas(venta);
      const cambio = Number((totalPagado - venta.totalNIO).toFixed(2));

      const row = sheet.addRow([
        venta.id,
        this.formatDate(venta.fecha),
        venta.totalNIO,
        totalPagado,
        cambio
      ]);
      this.styleDataRow(row);
      row.getCell(3).numFmt = CURRENCY_FORMAT;
      row.getCell(4).numFmt = CURRENCY_FORMAT;
      row.getCell(5).numFmt = CURRENCY_FORMAT;
    });

    sheet.addRow([]);
  }

  private renderItemsSection(
    sheet: Worksheet,
    ventas: Venta[],
    nombres: Map<string, string>
  ): void {
    this.addSectionTitle(sheet, "Detalle de productos vendidos");
    const headerRow = sheet.addRow([
      "Venta",
      "Producto",
      "Unidades",
      "Precio Unitario (C$)",
      "Subtotal (C$)"
    ]);
    this.styleTableHeader(headerRow);

    let hasItems = false;
    ventas.forEach((venta) => {
      venta.items.forEach((item) => {
        hasItems = true;
        const row = sheet.addRow([
          venta.id,
          nombres.get(item.productoId) ?? item.productoId,
          item.cantidad,
          item.precioUnitario,
          item.precioUnitario * item.cantidad
        ]);
        this.styleDataRow(row);
        row.getCell(3).numFmt = "0.00";
        row.getCell(4).numFmt = CURRENCY_FORMAT;
        row.getCell(5).numFmt = CURRENCY_FORMAT;
      });
    });

    if (!hasItems) {
      const emptyRow = sheet.addRow(["Sin productos", "", "", "", ""]);
      this.styleEmptyRow(emptyRow);
    }

    sheet.addRow([]);
  }

  private renderPagosSection(sheet: Worksheet, ventas: Venta[]): void {
    this.addSectionTitle(sheet, "Pagos registrados");
    const headerRow = sheet.addRow([
      "Venta",
      "Moneda",
      "Monto original",
      "Tasa aplicada",
      "Equivalente (C$)"
    ]);
    this.styleTableHeader(headerRow);

    let hasPayments = false;
    ventas.forEach((venta) => {
      (venta.pagos ?? []).forEach((pago) => {
        hasPayments = true;
        const moneda = pago.moneda.trim().toUpperCase();
        const tasa = pago.tasa ?? (moneda === "USD" ? 1 : undefined);
        const equivalente = moneda === "USD" ? pago.cantidad * (pago.tasa ?? 1) : pago.cantidad;

        const row = sheet.addRow([
          venta.id,
          moneda,
          pago.cantidad,
          tasa ?? "-",
          equivalente
        ]);
        this.styleDataRow(row);
        row.getCell(3).numFmt = moneda === "USD" ? "\"$\" #,##0.00" : CURRENCY_FORMAT;
        row.getCell(4).numFmt = "0.00";
        row.getCell(5).numFmt = CURRENCY_FORMAT;
      });
    });

    if (!hasPayments) {
      const emptyRow = sheet.addRow(["Sin pagos registrados", "", "", "", ""]);
      this.styleEmptyRow(emptyRow);
    }
  }

  private calcularPagadoCordobas(venta: Venta): number {
    return Number(
      (venta.pagos ?? []).reduce((acc, pago) => {
        const moneda = pago.moneda.trim().toUpperCase();
        const tasa = pago.tasa ?? 1;
        return acc + (moneda === "USD" ? pago.cantidad * tasa : pago.cantidad);
      }, 0).toFixed(2)
    );
  }

  private styleTableHeader(row: Row): void {
    row.font = { name: "Calibri", bold: true, color: { argb: "FF475569" }, size: 10 };
    row.height = 22;
    row.alignment = { vertical: "middle", horizontal: "center" };
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    row.border = {
      top: { style: "thin", color: { argb: "FFE2E8F0" } },
      left: { style: "thin", color: { argb: "FFE2E8F0" } },
      bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
      right: { style: "thin", color: { argb: "FFE2E8F0" } }
    };
  }

  private styleDataRow(row: Row): void {
    row.font = { name: "Calibri", size: 10, color: { argb: "FF0F172A" } };
    row.alignment = { vertical: "middle" };
    row.border = {
      left: { style: "hair", color: { argb: "FFE2E8F0" } },
      right: { style: "hair", color: { argb: "FFE2E8F0" } },
      bottom: { style: "hair", color: { argb: "FFE2E8F0" } }
    };
  }

  private styleEmptyRow(row: Row): void {
    this.styleDataRow(row);
    row.getCell(1).font = { name: "Calibri", italic: true, color: { argb: "FF94A3B8" } };
  }

  private addSectionTitle(sheet: Worksheet, text: string): void {
    const row = sheet.addRow([text]);
    sheet.mergeCells(`A${row.number}:G${row.number}`);
    row.font = { name: "Calibri", bold: true, size: 12, color: { argb: "FF1E293B" } };
    row.alignment = { horizontal: "left" };
    row.height = 24;
  }

  private formatDate(value?: string): string {
    if (!value) {
      return "";
    }
    return new Date(value).toLocaleString("es-NI");
  }

  private async obtenerNombresProductos(ventas: Venta[]): Promise<Map<string, string>> {
    const ids = new Set<string>();
    ventas.forEach((venta) => venta.items.forEach((item) => ids.add(item.productoId)));
    const map = new Map<string, string>();
    if (!ids.size) {
      return map;
    }

    const args = Array.from(ids);
    const placeholders = args.map(() => "?").join(",");
    const { rows } = await this.client.execute({
      sql: `SELECT id, nombre FROM productos WHERE id IN (${placeholders})`,
      args
    });

    rows.forEach((row) => {
      map.set(String(row.id), String(row.nombre));
    });

    return map;
  }
}
