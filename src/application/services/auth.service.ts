import { compare } from "bcrypt";
import { sign, type SignOptions } from "jsonwebtoken";
import type { JwtPayload } from "../../core/entities/auth";
import type { Usuario } from "../../core/entities/usuario.entity";
import { InMemoryDatabase } from "../../infrastructure/database/in-memory-db";

interface LoginResult {
  token: string;
  user: Pick<Usuario, "id" | "nombre" | "rol" | "username">;
}

export class AuthService {
  private readonly db = InMemoryDatabase.getInstance();
  private readonly jwtSecret = process.env.JWT_SECRET ?? "sist-alici-dev-secret";
  private readonly jwtExpiresIn = process.env.JWT_EXPIRES_IN ?? "8h";

  public async login(username: string, password: string): Promise<LoginResult> {
    const user = this.db.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
    if (!user) {
      throw new Error("Credenciales inválidas.");
    }

    const isValid = await compare(password, user.passwordHash);
    if (!isValid) {
      throw new Error("Credenciales inválidas.");
    }

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.rol
    };

    const signOptions: SignOptions = { expiresIn: this.jwtExpiresIn as SignOptions["expiresIn"] };
    const token = sign(payload, this.jwtSecret, signOptions);

    return {
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        rol: user.rol,
        username: user.username
      }
    };
  }
}
