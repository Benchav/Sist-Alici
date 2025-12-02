import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { WasteService } from "../../../application/services/waste.service";
import { Role } from "../../../core/entities/usuario.entity";
import { authenticateJWT, authorizeRoles } from "../middlewares/auth.middleware";

const wasteRouter = Router();
const wasteService = new WasteService();

const discardSchema = z.object({
  productoId: z.string().min(1, "productoId es requerido"),
  cantidad: z
    .number()
    .int("La cantidad debe ser entera")
    .positive("La cantidad debe ser mayor a cero"),
  motivo: z.string().min(3).max(255).optional()
});

wasteRouter.post(
  "/",
  authenticateJWT,
  authorizeRoles(Role.ADMIN, Role.PANADERO),
  async (req: Request, res: Response) => {
    const parsed = discardSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Error de validación",
        details: parsed.error.flatten()
      });
    }

    try {
      const { productoId, cantidad, motivo } = parsed.data;
      const data = await wasteService.registrarDescarte(productoId, cantidad, motivo);
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

export { wasteRouter };
