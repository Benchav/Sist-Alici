import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { SalesService } from "../../../application/services/sales.service";
import { Role } from "../../../core/entities/usuario.entity";
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
  (req: Request, res: Response) => {
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
  }
);

const handleControllerError = (error: unknown, res: Response) => {
  if (error instanceof Error) {
    return res.status(400).json({ error: error.message });
  }
  return res.status(500).json({ error: "Error interno del servidor" });
};

export { salesRouter };
