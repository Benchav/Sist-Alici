import type { RequestHandler } from "express";
import { verify } from "jsonwebtoken";
import type { JwtPayload } from "../../../core/entities/auth";
import { Role } from "../../../core/entities/usuario.entity";

const JWT_SECRET = process.env.JWT_SECRET ?? "sist-alici-dev-secret";

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authenticateJWT: RequestHandler = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    return res.status(401).json({ error: "Token no proporcionado." });
  }

  const token = authHeader.substring(7).trim();
  try {
    const decoded = verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Token inválido o expirado." });
  }
};

export const authorizeRoles = (...roles: Role[]): RequestHandler => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Token requerido." });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Acceso denegado." });
    }

    return next();
  };
};
