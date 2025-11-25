import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { SalesService } from "../../../application/services/sales.service";

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

/**
 * @swagger
 * /api/sales/checkout:
 *   post:
 *     summary: Procesar una venta con múltiples pagos
 *     tags: [Sales]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *               - pagos
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - productoId
 *                     - cantidad
 *                   properties:
 *                     productoId:
 *                       type: string
 *                     cantidad:
 *                       type: integer
 *               pagos:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - moneda
 *                     - cantidad
 *                   properties:
 *                     moneda:
 *                       type: string
 *                     cantidad:
 *                       type: number
 *                     tasa:
 *                       type: number
 *     responses:
 *       201:
 *         description: Venta procesada
 *       400:
 *         description: Error de validación o negocio
 *       500:
 *         description: Error interno del servidor
 */
salesRouter.post("/checkout", (req: Request, res: Response) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Error de validación",
      details: parsed.error.flatten()
    });
  }

  try {
    const { items, pagos } = parsed.data;
    const { venta, cambio } = salesService.procesarVenta(items, pagos);
    return res.status(201).json({ data: venta, cambio });
  } catch (error) {
    return handleControllerError(error, res);
  }
});

const handleControllerError = (error: unknown, res: Response) => {
  if (error instanceof Error) {
    return res.status(400).json({ error: error.message });
  }
  return res.status(500).json({ error: "Error interno del servidor" });
};

export { salesRouter };
