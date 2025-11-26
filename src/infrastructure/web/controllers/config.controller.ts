import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { getTursoClient } from "../../database/turso";
import { Role } from "../../../core/entities/usuario.entity";
import type { SystemConfig } from "../../../core/entities/config.entity";
import { authenticateJWT, authorizeRoles } from "../middlewares/auth.middleware";

/**
 * @swagger
 * tags:
 *   name: Config
 *   description: Administración de configuración del sistema
 */
const configRouter = Router();
const client = getTursoClient();

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
	async (_req: Request, res: Response) => {
		try {
			const data = await obtenerConfig();
			return res.status(200).json({ data });
		} catch (error) {
			return handleError(error, res);
		}
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
configRouter.put(
	"/",
	authenticateJWT,
	authorizeRoles(Role.ADMIN),
	async (req: Request, res: Response) => {
		const parsed = configSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({
				error: "Error de validación",
				details: parsed.error.flatten()
			});
		}

		try {
			const data = await actualizarConfig(parsed.data.tasaCambio);
			return res.status(200).json({ data });
		} catch (error) {
			return handleError(error, res);
		}
	}
);

const obtenerConfig = async (): Promise<SystemConfig> => {
	const { rows } = await client.execute({
		sql: "SELECT value FROM config WHERE key = ?",
		args: ["tasaCambio"]
	});

	if (rows.length) {
		const tasaCambio = Number(rows[0].value);
		if (Number.isFinite(tasaCambio) && tasaCambio > 0) {
			return { tasaCambio };
		}
	}

	return { tasaCambio: 1 };
};

const actualizarConfig = async (tasaCambio: number): Promise<SystemConfig> => {
	await client.execute({
		sql: `INSERT INTO config (key, value)
					VALUES ('tasaCambio', ?)
					ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
		args: [String(tasaCambio)]
	});

	return { tasaCambio };
};

const handleError = (error: unknown, res: Response) => {
	if (error instanceof Error) {
		return res.status(500).json({ error: error.message });
	}
	return res.status(500).json({ error: "Error interno del servidor" });
};

export { configRouter };
