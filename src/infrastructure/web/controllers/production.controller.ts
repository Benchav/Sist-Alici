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

const handleControllerError = (error: unknown, res: Response) => {
  if (error instanceof Error) {
    return res.status(400).json({ error: error.message });
  }
  return res.status(500).json({ error: "Error interno del servidor" });
};

export { productionRouter };
