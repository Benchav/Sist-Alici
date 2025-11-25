import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { InventoryService } from "../../../application/services/inventory.service";

/**
 * @swagger
 * tags:
 *   name: Inventory
 *   description: Gestión de inventario e insumos
 */
const inventoryRouter = Router();
const inventoryService = new InventoryService();

const purchaseSchema = z.object({
  insumoId: z.string().min(1, "insumoId es requerido"),
  cantidad: z.number().positive("La cantidad debe ser mayor a cero"),
  costoTotal: z.number().nonnegative("El costo total no puede ser negativo")
});

/**
 * @swagger
 * /api/inventory:
 *   get:
 *     summary: Listar insumos disponibles
 *     tags: [Inventory]
 *     responses:
 *       200:
 *         description: Lista de insumos registrados
 *       500:
 *         description: Error interno del servidor
 */
inventoryRouter.get("/", (_req: Request, res: Response) => {
  try {
    const data = inventoryService.listarInsumos();
    return res.status(200).json({ data });
  } catch (error) {
    return handleControllerError(error, res);
  }
});

/**
 * @swagger
 * /api/inventory/purchase:
 *   post:
 *     summary: Registrar compra de insumo
 *     tags: [Inventory]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - insumoId
 *               - cantidad
 *               - costoTotal
 *             properties:
 *               insumoId:
 *                 type: string
 *               cantidad:
 *                 type: number
 *                 example: 10
 *               costoTotal:
 *                 type: number
 *                 example: 500
 *     responses:
 *       201:
 *         description: Compra registrada
 *       400:
 *         description: Error de validación o negocio
 *       500:
 *         description: Error interno del servidor
 */
inventoryRouter.post("/purchase", (req: Request, res: Response) => {
  const parsed = purchaseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Error de validación",
      details: parsed.error.flatten()
    });
  }

  try {
    const { insumoId, cantidad, costoTotal } = parsed.data;
    const data = inventoryService.registrarCompra(insumoId, cantidad, costoTotal);
    return res.status(201).json({ data });
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

export { inventoryRouter };
