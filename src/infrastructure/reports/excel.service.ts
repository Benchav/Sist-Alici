import ExcelJS from "exceljs";
import type { Venta } from "../../core/entities/venta.entity";

export class ExcelService {
  public async generarReporteVentas(ventas: Venta[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Ventas");

    sheet.columns = [
      { header: "ID", key: "id", width: 24 },
      { header: "Fecha", key: "fecha", width: 24 },
      { header: "Total Venta (C$)", key: "total", width: 18 },
      { header: "Pagado (C$)", key: "pagado", width: 18 },
      { header: "Cambio (C$)", key: "cambio", width: 16 }
    ];

    ventas.forEach((venta) => {
      const pagado = venta.pagos.reduce((acc, pago) => {
        const moneda = pago.moneda.trim().toUpperCase();
        const tasa = pago.tasa ?? 1;
        return acc + (moneda === "USD" ? pago.cantidad * tasa : pago.cantidad);
      }, 0);

      const cambio = Number((pagado - venta.totalNIO).toFixed(2));

      sheet.addRow({
        id: venta.id,
        fecha: venta.fecha ?? "",
        total: venta.totalNIO,
        pagado: Number(pagado.toFixed(2)),
        cambio
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  }
}
