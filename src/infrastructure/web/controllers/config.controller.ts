import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { InMemoryDatabase } from "../../database/in-memory-db";
import { Role } from "../../../core/entities/usuario.entity";
import { authenticateJWT, authorizeRoles } from "../middlewares/auth.middleware";

/**
 * @swagger
 * tags:
 *   name: Config
 *   description: Administración de configuración del sistema
 */
const configRouter = Router();
const db = InMemoryDatabase.getInstance();

const configSchema = z.object({
	tasaCambio: z.number().positive("La tasa de cambio debe ser mayor a cero")
});

/**
 * @swagger
 * /api/config:
 *   get:
 *     summary: Obtener configuración actual del sistema
 *     tags: [Config]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configuración vigente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/SystemConfig'
 */
configRouter.get(
	"/",
	authenticateJWT,
	authorizeRoles(Role.ADMIN, Role.PANADERO, Role.CAJERO),
	(_req: Request, res: Response) => {
		return res.status(200).json({ data: db.config });
	}
);

/**
 * @swagger
 * /api/config:
 *   put:
 *     summary: Actualizar la tasa de cambio
 *     tags: [Config]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tasaCambio:
 *                 type: number
 *                 example: 36.75
 *     responses:
 *       200:
 *         description: Configuración actualizada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/SystemConfig'
 */
configRouter.put("/", authenticateJWT, authorizeRoles(Role.ADMIN), (req: Request, res: Response) => {
	const parsed = configSchema.safeParse(req.body);
	if (!parsed.success) {
		return res.status(400).json({
			error: "Error de validación",
			details: parsed.error.flatten()
		});
	}

	db.config = { ...db.config, tasaCambio: parsed.data.tasaCambio };
	return res.status(200).json({ data: db.config });
});

export { configRouter };
