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

const insumoBaseSchema = z.object({
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  unidad: z.string().min(1, "La unidad es requerida"),
  stock: z.number().nonnegative("El stock no puede ser negativo").optional(),
  costoPromedio: z.number().nonnegative("El costo promedio no puede ser negativo").optional()
});

const createInsumoSchema = insumoBaseSchema;
const updateInsumoSchema = insumoBaseSchema.partial();

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
    const data = inventoryService.findAll();
    return res.status(200).json({ data });
  } catch (error) {
    return handleControllerError(error, res);
  }
});

/**
 * @swagger
 * /api/inventory:
 *   post:
 *     summary: Crear un nuevo insumo
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InsumoRequest'
 *     responses:
 *       201:
 *         description: Insumo creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InsumoResponse'
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
inventoryRouter.post("/", authenticateJWT, authorizeRoles(Role.ADMIN), (req: Request, res: Response) => {
  const parsed = createInsumoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Error de validación",
      details: parsed.error.flatten()
    });
  }

  try {
    const data = inventoryService.createInsumo(parsed.data);
    return res.status(201).json({ data });
  } catch (error) {
    return handleControllerError(error, res);
  }
});

/**
 * @swagger
 * /api/inventory/{id}:
 *   put:
 *     summary: Actualizar un insumo existente
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InsumoUpdateRequest'
 *     responses:
 *       200:
 *         description: Insumo actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InsumoResponse'
 *       400:
 *         description: Error de validación o negocio
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Insumo no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
inventoryRouter.put("/:id", authenticateJWT, authorizeRoles(Role.ADMIN), (req: Request, res: Response) => {
  const parsed = updateInsumoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Error de validación",
      details: parsed.error.flatten()
    });
  }

  try {
    const data = inventoryService.updateInsumo(req.params.id, parsed.data);
    return res.status(200).json({ data });
  } catch (error) {
    return handleControllerError(error, res);
  }
});

/**
 * @swagger
 * /api/inventory/{id}:
 *   delete:
 *     summary: Eliminar un insumo
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Operación exitosa sin contenido
 *       404:
 *         description: Insumo no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
inventoryRouter.delete("/:id", authenticateJWT, authorizeRoles(Role.ADMIN), (req: Request, res: Response) => {
  try {
    inventoryService.deleteInsumo(req.params.id);
    return res.status(204).send();
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
