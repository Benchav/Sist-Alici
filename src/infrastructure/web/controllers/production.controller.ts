import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { ProductionService } from "../../../application/services/production.service";
import { Role } from "../../../core/entities/usuario.entity";
import { authenticateJWT, authorizeRoles } from "../middlewares/auth.middleware";

/**
 * @swagger
 * tags:
 *   name: Production
 *   description: Gestión de recetas y órdenes de producción
 */
const productionRouter = Router();
const productionService = new ProductionService();

const productionSchema = z.object({
  recetaId: z.string().min(1, "recetaId es requerido"),
  cantidad: z
    .number()
    .int("La cantidad debe ser entera")
    .positive("La cantidad debe ser mayor a cero")
});

const productoSchema = z.object({
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  stockDisponible: z.number().nonnegative("El stock no puede ser negativo").optional(),
  precioUnitario: z.number().nonnegative("El precio unitario no puede ser negativo").optional(),
  precioVenta: z.number().nonnegative("El precio de venta no puede ser negativo").optional()
});

const updateProductoSchema = productoSchema.partial();

const recetaItemSchema = z.object({
  insumoId: z.string().min(1, "insumoId es requerido"),
  cantidad: z.number().positive("La cantidad debe ser mayor a cero")
});

const upsertRecetaSchema = z.object({
  id: z.string().min(1).optional(),
  productoId: z.string().min(1, "productoId es requerido"),
  costoManoObra: z.number().nonnegative("El costo de mano de obra no puede ser negativo").optional(),
  items: z.array(recetaItemSchema).min(1, "Debe proporcionar al menos un insumo")
});

/**
 * @swagger
 * /api/production:
 *   post:
 *     summary: Registrar un lote de producción
 *     tags: [Production]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductionRequest'
 *     responses:
 *       201:
 *         description: Producción registrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductionResponse'
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
  "/",
  authenticateJWT,
  authorizeRoles(Role.ADMIN, Role.PANADERO),
  (req: Request, res: Response) => {
  const parsed = productionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Error de validación",
      details: parsed.error.flatten()
    });
  }

    try {
      const { recetaId, cantidad } = parsed.data;
      const data = productionService.registrarProduccion(recetaId, cantidad);
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
  (_req: Request, res: Response) => {
    try {
      const data = productionService.listarProductos();
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
productionRouter.post("/products", authenticateJWT, authorizeRoles(Role.ADMIN), (req: Request, res: Response) => {
  const parsed = productoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Error de validación",
      details: parsed.error.flatten()
    });
  }

  try {
    const data = productionService.crearProducto(parsed.data);
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
productionRouter.put("/products/:id", authenticateJWT, authorizeRoles(Role.ADMIN), (req: Request, res: Response) => {
  const parsed = updateProductoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Error de validación",
      details: parsed.error.flatten()
    });
  }

  try {
    const data = productionService.actualizarProducto(req.params.id, parsed.data);
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
productionRouter.delete("/products/:id", authenticateJWT, authorizeRoles(Role.ADMIN), (req: Request, res: Response) => {
  try {
    productionService.eliminarProducto(req.params.id);
    return res.status(204).send();
  } catch (error) {
    return handleControllerError(error, res);
  }
});

/**
 * @swagger
 * /api/production/recipes:
 *   get:
 *     summary: Listar recetas disponibles
 *     tags: [Production]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Listado de recetas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RecetaListResponse'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
productionRouter.get(
  "/recipes",
  authenticateJWT,
  authorizeRoles(Role.ADMIN, Role.PANADERO),
  (_req: Request, res: Response) => {
    try {
      const data = productionService.listarRecetas();
      return res.status(200).json({ data });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }
);

/**
 * @swagger
 * /api/production/recipes:
 *   post:
 *     summary: Crear o actualizar una receta
 *     tags: [Production]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpsertRecetaRequest'
 *     responses:
 *       200:
 *         description: Receta actualizada o creada correctamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RecetaResponse'
 */
productionRouter.post(
  "/recipes",
  authenticateJWT,
  authorizeRoles(Role.ADMIN),
  (req: Request, res: Response) => {
    const parsed = upsertRecetaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Error de validación",
        details: parsed.error.flatten()
      });
    }

    try {
      const data = productionService.upsertReceta(parsed.data);
      return res.status(200).json({ data });
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

export { productionRouter };
