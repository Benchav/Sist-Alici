import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { AuthService } from "../../../application/services/auth.service";

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Inicio de sesión y emisión de tokens JWT
 */
const authRouter = Router();
const authService = new AuthService();

const loginSchema = z.object({
  username: z.string().min(3, "El usuario es requerido"),
  password: z.string().min(6, "La contraseña es requerida")
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Iniciar sesión y obtener un token JWT
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthLoginRequest'
 *     responses:
 *       200:
 *         description: Inicio de sesión exitoso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthLoginResponse'
 *       400:
 *         description: Error de validación o credenciales inválidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
authRouter.post("/login", async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Error de validación",
      details: parsed.error.flatten()
    });
  }

  try {
    const { username, password } = parsed.data;
    const result = await authService.login(username, password);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message });
  }
});

export { authRouter };
