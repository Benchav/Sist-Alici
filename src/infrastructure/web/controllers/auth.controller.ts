import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { AuthService } from "../../../application/services/auth.service";
import { Role } from "../../../core/entities/usuario.entity";
import { authenticateJWT, authorizeRoles } from "../middlewares/auth.middleware";

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

const registerSchema = z.object({
  username: z.string().min(3, "El usuario es requerido"),
  nombre: z.string().min(3, "El nombre es requerido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  rol: z.nativeEnum(Role)
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

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Registrar un nuevo usuario del sistema
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthRegisterRequest'
 *     responses:
 *       201:
 *         description: Usuario creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthUserResponse'
 */
authRouter.post(
  "/register",
  authenticateJWT,
  authorizeRoles(Role.ADMIN),
  async (req: Request, res: Response) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Error de validación",
        details: parsed.error.flatten()
      });
    }

    try {
      const data = await authService.registerUser(parsed.data);
      return res.status(201).json({ data });
    } catch (error) {
      return res.status(400).json({ error: (error as Error).message });
    }
  }
);

/**
 * @swagger
 * /api/auth/users:
 *   get:
 *     summary: Listar usuarios registrados
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Listado de usuarios
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthUserListResponse'
 */
authRouter.get(
  "/users",
  authenticateJWT,
  authorizeRoles(Role.ADMIN),
  async (_req: Request, res: Response) => {
    try {
      const data = await authService.listUsers();
      return res.status(200).json({ data });
    } catch (error) {
      return res.status(400).json({ error: (error as Error).message });
    }
  }
);

/**
 * @swagger
 * /api/auth/users/{id}:
 *   delete:
 *     summary: Eliminar un usuario
 *     tags: [Auth]
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
 *         description: Usuario eliminado
 */
authRouter.delete(
  "/users/:id",
  authenticateJWT,
  authorizeRoles(Role.ADMIN),
  async (req: Request, res: Response) => {
    try {
      await authService.deleteUser(req.params.id);
      return res.status(204).send();
    } catch (error) {
      return res.status(400).json({ error: (error as Error).message });
    }
  }
);

export { authRouter };
