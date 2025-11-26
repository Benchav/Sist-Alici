import type { Role } from "./usuario.entity";

export interface JwtPayload {
  sub: string;
  id: string;
  username: string;
  role: Role;
  iat?: number;
  exp?: number;
}
