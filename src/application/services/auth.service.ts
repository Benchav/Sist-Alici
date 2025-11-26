import { compare, hash } from "bcrypt";
import { randomUUID } from "node:crypto";
import { sign, type SignOptions } from "jsonwebtoken";
import type { JwtPayload } from "../../core/entities/auth";
import { Role, type Usuario } from "../../core/entities/usuario.entity";
import { getTursoClient } from "../../infrastructure/database/turso";

interface LoginResult {
  token: string;
  user: Pick<Usuario, "id" | "nombre" | "rol" | "username">;
}

interface RegisterUserInput {
  username: string;
  nombre: string;
  password: string;
  rol: Role;
}

export class AuthService {
  private readonly client = getTursoClient();
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn = process.env.JWT_EXPIRES_IN ?? "8h";

  constructor() {
    this.jwtSecret = this.resolveJwtSecret();
  }

  public async listUsers(): Promise<LoginResult["user"][]> {
    const result = await this.client.execute(
      "SELECT id, username, nombre, rol FROM usuarios ORDER BY nombre"
    );
    return result.rows.map((row) => this.toSafeUser(this.mapRowToUsuario(row)));
  }

  public async findUserById(id: string): Promise<Usuario> {
    const { rows } = await this.client.execute({
      sql: "SELECT id, username, nombre, rol, password_hash FROM usuarios WHERE id = ?",
      args: [id]
    });

    if (!rows.length) {
      throw new Error("Usuario no encontrado.");
    }

    return this.mapRowToUsuario(rows[0]);
  }

  public async registerUser(input: RegisterUserInput): Promise<LoginResult["user"]> {
    const username = input.username.trim();
    const nombre = input.nombre.trim();

    const passwordHash = await hash(input.password, 10);
    const user: Usuario = {
      id: `USR-${randomUUID()}`,
      username,
      nombre,
      rol: input.rol,
      passwordHash
    };

    try {
      await this.client.execute({
        sql: `INSERT INTO usuarios (id, username, nombre, rol, password_hash)
              VALUES (?, ?, ?, ?, ?)` ,
        args: [user.id, user.username, user.nombre, user.rol, user.passwordHash]
      });
    } catch (error) {
      if (this.isUniqueUsernameError(error)) {
        throw new Error("El nombre de usuario ya está en uso.");
      }
      throw error;
    }

    return this.toSafeUser(user);
  }

  public async deleteUser(id: string): Promise<void> {
    const result = await this.client.execute({
      sql: "DELETE FROM usuarios WHERE id = ?",
      args: [id]
    });

    if ((result.rowsAffected ?? 0) === 0) {
      throw new Error("Usuario no encontrado.");
    }
  }

  public async login(username: string, password: string): Promise<LoginResult> {
    const { rows } = await this.client.execute({
      sql: `SELECT id, username, nombre, rol, password_hash
            FROM usuarios
            WHERE LOWER(username) = LOWER(?)
            LIMIT 1`,
      args: [username]
    });

    if (!rows.length) {
      throw new Error("Credenciales inválidas.");
    }

    const user = this.mapRowToUsuario(rows[0]);
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
      user: this.toSafeUser(user)
    };
  }

  private mapRowToUsuario(row: Record<string, unknown>): Usuario {
    return {
      id: String(row.id),
      username: String(row.username),
      nombre: String(row.nombre),
      rol: row.rol as Role,
      passwordHash: String(row.password_hash)
    };
  }

  private toSafeUser(user: Usuario): LoginResult["user"] {
    return {
      id: user.id,
      nombre: user.nombre,
      rol: user.rol,
      username: user.username
    };
  }

  private resolveJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("Missing JWT_SECRET environment variable.");
    }
    return secret;
  }

  private isUniqueUsernameError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    return /UNIQUE constraint failed: usuarios\.username/i.test(error.message);
  }
}
