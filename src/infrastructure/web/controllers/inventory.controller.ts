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

const finishedGoodsPurchaseSchema = z.object({
  productoId: z.string().min(1, "productoId es requerido"),
  cantidad: z.number().positive("La cantidad debe ser mayor a cero"),
  costoTotal: z.number().nonnegative("El costo total no puede ser negativo")
});

const insumoBaseSchema = z.object({
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  unidad: z.string().min(1, "La unidad es requerida"),
  stock: z.number().nonnegative("El stock no puede ser negativo").optional(),
  costoPromedio: z.number().nonnegative("El costo promedio no puede ser negativo").optional(),
  proveedorPrincipalId: z.string().min(1).optional()
});

const createInsumoSchema = insumoBaseSchema;
const updateInsumoSchema = insumoBaseSchema.partial();

const categoriaTipos = ["PRODUCCION", "REVENTA", "INSUMO"] as const;

const categoriaSchema = z.object({
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  tipo: z.enum(categoriaTipos)
});

const updateCategoriaSchema = categoriaSchema.partial();

const proveedorSchema = z.object({
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  frecuenciaCredito: z.string().min(3).optional(),
  contacto: z.string().min(5).optional()
});

const updateProveedorSchema = proveedorSchema.partial();

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
inventoryRouter.get(
  "/",
  authenticateJWT,
  authorizeRoles(Role.ADMIN, Role.PANADERO, Role.CAJERO),
  async (_req: Request, res: Response) => {
    try {
      const data = await inventoryService.findAll();
      return res.status(200).json({ data });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }
);

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
inventoryRouter.post("/", authenticateJWT, authorizeRoles(Role.ADMIN), async (req: Request, res: Response) => {
  const parsed = createInsumoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Error de validación",
      details: parsed.error.flatten()
    });
  }

  try {
    const data = await inventoryService.createInsumo(parsed.data);
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
inventoryRouter.put("/:id", authenticateJWT, authorizeRoles(Role.ADMIN), async (req: Request, res: Response) => {
  const parsed = updateInsumoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Error de validación",
      details: parsed.error.flatten()
    });
  }

  try {
    const data = await inventoryService.updateInsumo(req.params.id, parsed.data);
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
inventoryRouter.delete(
  "/:id",
  authenticateJWT,
  authorizeRoles(Role.ADMIN),
  async (req: Request, res: Response) => {
    try {
      await inventoryService.deleteInsumo(req.params.id);
      return res.status(204).send();
    } catch (error) {
      return handleControllerError(error, res);
    }
  }
);

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
  async (req: Request, res: Response) => {
  const parsed = purchaseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Error de validación",
      details: parsed.error.flatten()
    });
  }

    try {
      const { insumoId, cantidad, costoTotal } = parsed.data;
      const data = await inventoryService.registrarCompra(insumoId, cantidad, costoTotal);
      return res.status(201).json({ data });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }
);

/**
 * @swagger
 * /api/inventory/purchase/finished:
 *   post:
 *     summary: Registrar compra de productos terminados para reventa
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FinishedGoodsPurchaseRequest'
 *     responses:
 *       201:
 *         description: Compra registrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductoResponse'
 *       400:
 *         description: Error de validación o negocio
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
inventoryRouter.post(
  "/purchase/finished",
  authenticateJWT,
  authorizeRoles(Role.ADMIN),
  async (req: Request, res: Response) => {
    const parsed = finishedGoodsPurchaseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Error de validación",
        details: parsed.error.flatten()
      });
    }

    try {
      const { productoId, cantidad, costoTotal } = parsed.data;
      const data = await inventoryService.registrarCompraProductoTerminado(productoId, cantidad, costoTotal);
      return res.status(201).json({ data });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }
);

/**
 * @swagger
 * /api/inventory/categories:
 *   get:
 *     summary: Listar categorías de inventario
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Listado de categorías
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CategoriaListResponse'
 */
inventoryRouter.get(
  "/categories",
  authenticateJWT,
  authorizeRoles(Role.ADMIN, Role.PANADERO, Role.CAJERO),
  async (_req: Request, res: Response) => {
    try {
      const data = await inventoryService.listarCategorias();
      return res.status(200).json({ data });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }
);

/**
 * @swagger
 * /api/inventory/categories:
 *   post:
 *     summary: Crear una categoría
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CategoriaRequest'
 *     responses:
 *       201:
 *         description: Categoría creada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CategoriaResponse'
 */
inventoryRouter.post(
  "/categories",
  authenticateJWT,
  authorizeRoles(Role.ADMIN),
  async (req: Request, res: Response) => {
    const parsed = categoriaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Error de validación",
        details: parsed.error.flatten()
      });
    }

    try {
      const data = await inventoryService.crearCategoria(parsed.data);
      return res.status(201).json({ data });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }
);

/**
 * @swagger
 * /api/inventory/categories/{id}:
 *   put:
 *     summary: Actualizar una categoría
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
 *             $ref: '#/components/schemas/CategoriaUpdateRequest'
 *     responses:
 *       200:
 *         description: Categoría actualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CategoriaResponse'
 */
inventoryRouter.put(
  "/categories/:id",
  authenticateJWT,
  authorizeRoles(Role.ADMIN),
  async (req: Request, res: Response) => {
    const parsed = updateCategoriaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Error de validación",
        details: parsed.error.flatten()
      });
    }

    try {
      const data = await inventoryService.actualizarCategoria(req.params.id, parsed.data);
      return res.status(200).json({ data });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }
);

/**
 * @swagger
 * /api/inventory/categories/{id}:
 *   delete:
 *     summary: Eliminar una categoría
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
 *         description: Categoría eliminada
 */
inventoryRouter.delete(
  "/categories/:id",
  authenticateJWT,
  authorizeRoles(Role.ADMIN),
  async (req: Request, res: Response) => {
    try {
      await inventoryService.eliminarCategoria(req.params.id);
      return res.status(204).send();
    } catch (error) {
      return handleControllerError(error, res);
    }
  }
);

/**
 * @swagger
 * /api/inventory/providers:
 *   get:
 *     summary: Listar proveedores
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Listado de proveedores
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProveedorListResponse'
 */
inventoryRouter.get(
  "/providers",
  authenticateJWT,
  authorizeRoles(Role.ADMIN, Role.PANADERO, Role.CAJERO),
  async (_req: Request, res: Response) => {
    try {
      const data = await inventoryService.listarProveedores();
      return res.status(200).json({ data });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }
);

/**
 * @swagger
 * /api/inventory/providers:
 *   post:
 *     summary: Registrar un proveedor
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProveedorRequest'
 *     responses:
 *       201:
 *         description: Proveedor creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProveedorResponse'
 */
inventoryRouter.post(
  "/providers",
  authenticateJWT,
  authorizeRoles(Role.ADMIN),
  async (req: Request, res: Response) => {
    const parsed = proveedorSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Error de validación",
        details: parsed.error.flatten()
      });
    }

    try {
      const data = await inventoryService.crearProveedor(parsed.data);
      return res.status(201).json({ data });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }
);

/**
 * @swagger
 * /api/inventory/providers/{id}:
 *   put:
 *     summary: Actualizar un proveedor
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
 *             $ref: '#/components/schemas/ProveedorUpdateRequest'
 *     responses:
 *       200:
 *         description: Proveedor actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProveedorResponse'
 */
inventoryRouter.put(
  "/providers/:id",
  authenticateJWT,
  authorizeRoles(Role.ADMIN),
  async (req: Request, res: Response) => {
    const parsed = updateProveedorSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Error de validación",
        details: parsed.error.flatten()
      });
    }

    try {
      const data = await inventoryService.actualizarProveedor(req.params.id, parsed.data);
      return res.status(200).json({ data });
    } catch (error) {
      return handleControllerError(error, res);
    }
  }
);

/**
 * @swagger
 * /api/inventory/providers/{id}:
 *   delete:
 *     summary: Eliminar un proveedor
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
 *         description: Proveedor eliminado
 */
inventoryRouter.delete(
  "/providers/:id",
  authenticateJWT,
  authorizeRoles(Role.ADMIN),
  async (req: Request, res: Response) => {
    try {
      await inventoryService.eliminarProveedor(req.params.id);
      return res.status(204).send();
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
