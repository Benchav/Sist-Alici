import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { ProductionService } from "../../../application/services/production.service";
import { Role } from "../../../core/entities/usuario.entity";
import { authenticateJWT, authorizeRoles } from "../middlewares/auth.middleware";

/**
 * @swagger
 * tags:
 *   name: Production
 *   description: Gestión de producción y stock diario
 */
const productionRouter = Router();
const productionService = new ProductionService();

const productoSchema = z.object({
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  stockDisponible: z.number().nonnegative("El stock no puede ser negativo").optional(),
  precioUnitario: z.number().nonnegative("El precio unitario no puede ser negativo").optional(),
  precioVenta: z.number().nonnegative("El precio de venta no puede ser negativo").optional(),
  categoriaId: z.string().min(1).optional()
});

const updateProductoSchema = productoSchema.partial();

const consumoItemSchema = z.object({
  insumoId: z.string().min(1, "insumoId es requerido"),
  cantidad: z.number().positive("La cantidad debe ser mayor a cero")
});

const dailyProductionLotSchema = z.object({
  productoId: z.string().min(1, "productoId es requerido"),
  cantidadProducida: z.number().positive("La cantidad producida debe ser mayor a cero"),
  costoManoObra: z.number().nonnegative("El costo de mano de obra no puede ser negativo").optional(),
  insumos: z
    .array(consumoItemSchema)
    .min(1, "Debe proporcionar al menos un insumo consumido")
});

const dailyProductionSchema = z
  .array(dailyProductionLotSchema)
  .min(1, "Debe proporcionar al menos un lote diario");

/**
 * @swagger
 * /api/production/history:
 *   get:
 *     summary: Obtener historial de órdenes de producción
 *     tags: [Production]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Historial de producción
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ProductionResponse'
 */
productionRouter.get(
  "/history",
  authenticateJWT,
  authorizeRoles(Role.ADMIN),
  (_req: Request, res: Response) => {
    try {
      const data = productionService.obtenerHistorial();
      return res.status(200).json({ data });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }
);

/**
 * @swagger
 * /api/production/daily:
 *   post:
 *     summary: Registrar producción diaria basada en consumo real
 *     tags: [Production]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DailyProductionRequest'
 *     responses:
 *       201:
 *         description: Producción diaria registrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DailyProductionResponse'
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
productionRouter.post(
  "/daily",
  authenticateJWT,
  authorizeRoles(Role.ADMIN, Role.PANADERO),
  async (req: Request, res: Response) => {
    const parsed = dailyProductionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Error de validación",
        details: parsed.error.flatten()
      });
    }

    try {
      const data = await productionService.registrarProduccionDiaria(parsed.data);
      return res.status(201).json({ data });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }
);

/**
 * @swagger
 * /api/production/products:
 *   get:
 *     summary: Listar productos disponibles
 *     tags: [Production]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Listado de productos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductoListResponse'
 */
productionRouter.get(
  "/products",
  authenticateJWT,
  authorizeRoles(Role.ADMIN, Role.PANADERO, Role.CAJERO),
  async (_req: Request, res: Response) => {
    try {
      const data = await productionService.listarProductos();
      return res.status(200).json({ data });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }
);

/**
 * @swagger
 * /api/production/products:
 *   post:
 *     summary: Registrar un nuevo producto
 *     tags: [Production]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CrearProductoRequest'
 *     responses:
 *       201:
 *         description: Producto creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductoResponse'
 */
productionRouter.post("/products", authenticateJWT, authorizeRoles(Role.ADMIN), async (req: Request, res: Response) => {
  const parsed = productoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Error de validación",
      details: parsed.error.flatten()
    });
  }

  try {
    const data = await productionService.crearProducto(parsed.data);
    return res.status(201).json({ data });
  } catch (error) {
    return handleControllerError(error, res);
  }
});

/**
 * @swagger
 * /api/production/products/{id}:
 *   put:
 *     summary: Actualizar un producto
 *     tags: [Production]
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
 *             $ref: '#/components/schemas/ActualizarProductoRequest'
 *     responses:
 *       200:
 *         description: Producto actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductoResponse'
 */
productionRouter.put("/products/:id", authenticateJWT, authorizeRoles(Role.ADMIN), async (req: Request, res: Response) => {
  const parsed = updateProductoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Error de validación",
      details: parsed.error.flatten()
    });
  }

  try {
    const data = await productionService.actualizarProducto(req.params.id, parsed.data);
    return res.status(200).json({ data });
  } catch (error) {
    return handleControllerError(error, res);
  }
});

/**
 * @swagger
 * /api/production/products/{id}:
 *   delete:
 *     summary: Eliminar un producto
 *     tags: [Production]
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
 *         description: Producto eliminado
 */
productionRouter.delete("/products/:id", authenticateJWT, authorizeRoles(Role.ADMIN), async (req: Request, res: Response) => {
  try {
    await productionService.eliminarProducto(req.params.id);
    return res.status(204).send();
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

export { productionRouter };
