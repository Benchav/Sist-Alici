import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { SalesService } from "../../../application/services/sales.service";
import { Role } from "../../../core/entities/usuario.entity";
import { PdfService } from "../../reports/pdf.service";
import { ExcelService } from "../../reports/excel.service";
import { authenticateJWT, authorizeRoles } from "../middlewares/auth.middleware";

/**
 * @swagger
 * tags:
 *   name: Sales
 *   description: Procesamiento de ventas y pagos
 */
const salesRouter = Router();

const tasaCambioEnv = Number(process.env.TASA_CAMBIO_BASE);
const salesService = Number.isFinite(tasaCambioEnv) && tasaCambioEnv > 0
  ? new SalesService({ tasaCambio: tasaCambioEnv })
  : new SalesService();
const pdfService = new PdfService();
const excelService = new ExcelService();

const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        productoId: z.string().min(1, "productoId es requerido"),
        cantidad: z
          .number()
          .int("La cantidad debe ser entera")
          .positive("La cantidad debe ser mayor a cero")
      })
    )
    .nonempty("Debe incluir al menos un producto."),
  pagos: z
    .array(
      z.object({
        moneda: z.string().min(1, "La moneda es requerida"),
        cantidad: z.number().positive("La cantidad debe ser mayor a cero"),
        tasa: z.number().positive("La tasa debe ser mayor a cero").optional()
      })
    )
    .nonempty("Debe registrar al menos un pago.")
});

const parseDateRange = (query: Request["query"]): { from?: Date; to?: Date } => {
  const normalize = (value: unknown): string | undefined => {
    if (Array.isArray(value)) {
      value = value[0];
    }
    if (typeof value !== "string") {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  };

  const parseParam = (raw: string | undefined, label: string): Date | undefined => {
    if (!raw) {
      return undefined;
    }
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`El parámetro ${label} debe ser una fecha ISO válida.`);
    }
    return date;
  };

  const from = parseParam(normalize(query.from), "from");
  const to = parseParam(normalize(query.to), "to");

  if (from && to && from.getTime() > to.getTime()) {
    throw new Error("El parámetro from debe ser anterior o igual a to.");
  }

  return { from, to };
};

/**
 * @swagger
 * /api/sales/report/excel:
 *   get:
 *     summary: Descargar reporte de ventas en Excel
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Fecha inicial en formato ISO (inclusiva)
 *       - in: query
 *         name: to
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Fecha final en formato ISO (inclusiva)
 *     responses:
 *       200:
 *         description: Archivo Excel generado
 */
salesRouter.get(
  "/report/excel",
  authenticateJWT,
  authorizeRoles(Role.ADMIN),
  async (req: Request, res: Response) => {
    try {
      const { from, to } = parseDateRange(req.query);
      const ventas = await salesService.obtenerHistorial(from, to);
      const buffer = await excelService.generarReporteVentas(ventas);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Disposition", 'attachment; filename="ventas.xlsx"');
      return res.send(buffer);
    } catch (error) {
      return handleControllerError(error, res);
    }
  }
);

/**
 * @swagger
 * /api/sales/{id}/pdf:
 *   get:
 *     summary: Descargar factura PDF de una venta
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: PDF generado
 */
salesRouter.get(
  "/:id/pdf",
  authenticateJWT,
  authorizeRoles(Role.ADMIN, Role.CAJERO),
  async (req: Request, res: Response) => {
    try {
      const venta = await salesService.obtenerVentaPorId(req.params.id);
      const buffer = await pdfService.generarFactura(venta);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="venta-${venta.id}.pdf"`);
      return res.send(buffer);
    } catch (error) {
      return handleControllerError(error, res);
    }
  }
);

/**
 * @swagger
 * /api/sales:
 *   get:
 *     summary: Listar historial de ventas
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Fecha inicial en formato ISO (inclusiva)
 *       - in: query
 *         name: to
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Fecha final en formato ISO (inclusiva)
 *     responses:
 *       200:
 *         description: Historial de ventas en orden descendente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SalesHistoryResponse'
 */
salesRouter.get(
  "/",
  authenticateJWT,
  authorizeRoles(Role.ADMIN, Role.CAJERO),
  async (req: Request, res: Response) => {
    try {
      const { from, to } = parseDateRange(req.query);
      const data = await salesService.obtenerHistorial(from, to);
      return res.status(200).json({ data });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }
);

/**
 * @swagger
 * /api/sales/{id}:
 *   get:
 *     summary: Obtener detalle de una venta específica
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Venta encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SalesDetailResponse'
 */
salesRouter.get(
  "/:id",
  authenticateJWT,
  authorizeRoles(Role.ADMIN, Role.CAJERO),
  async (req: Request, res: Response) => {
    try {
      const data = await salesService.obtenerVentaPorId(req.params.id);
      return res.status(200).json({ data });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }
);

/**
 * @swagger
 * /api/sales/{id}:
 *   delete:
 *     summary: Anular una venta y revertir inventario
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Venta anulada correctamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SalesDetailResponse'
 */
salesRouter.delete(
  "/:id",
  authenticateJWT,
  authorizeRoles(Role.ADMIN),
  async (req: Request, res: Response) => {
    try {
      const data = await salesService.anularVenta(req.params.id);
      return res.status(200).json({ data });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }
);

/**
 * @swagger
 * /api/sales/checkout:
 *   post:
 *     summary: Procesar una venta con múltiples pagos
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SalesCheckoutRequest'
 *     responses:
 *       201:
 *         description: Venta procesada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SalesCheckoutResponse'
 *       400:
 *         description: Error de validación o negocio
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
salesRouter.post(
  "/checkout",
  authenticateJWT,
  authorizeRoles(Role.ADMIN, Role.CAJERO),
  async (req: Request, res: Response) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Error de validación",
      details: parsed.error.flatten()
    });
  }

    try {
      const { items, pagos } = parsed.data;
      const usuarioId = req.user?.id ?? req.user?.sub;
      if (!usuarioId) {
        return res.status(401).json({ error: "Usuario no autenticado." });
      }

      const { venta, cambio } = await salesService.procesarVenta(items, pagos, usuarioId);
      return res.status(201).json({ data: venta, cambio });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }
);

const handleControllerError = (error: unknown, res: Response) => {
  if (error instanceof Error) {
    return res.status(400).json({ error: error.message });
  }
  return res.status(500).json({ error: "Error interno del servidor" });
};

export { salesRouter };
