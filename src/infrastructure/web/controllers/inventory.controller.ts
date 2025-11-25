import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { InventoryService } from "../../../application/services/inventory.service";
import { Role } from "../../../core/entities/usuario.entity";
import { authenticateJWT, authorizeRoles } from "../middlewares/auth.middleware";

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
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de insumos registrados
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InsumoListResponse'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
inventoryRouter.get("/", authenticateJWT, authorizeRoles(Role.ADMIN, Role.PANADERO, Role.CAJERO), (_req: Request, res: Response) => {
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
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PurchaseRequest'
 *     responses:
 *       201:
 *         description: Compra registrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PurchaseResponse'
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
inventoryRouter.post(
  "/purchase",
  authenticateJWT,
  authorizeRoles(Role.ADMIN, Role.PANADERO),
  (req: Request, res: Response) => {
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
  }
);

const handleControllerError = (error: unknown, res: Response) => {
  if (error instanceof Error) {
    return res.status(400).json({ error: error.message });
  }
  return res.status(500).json({ error: "Error interno del servidor" });
};

export { inventoryRouter };
