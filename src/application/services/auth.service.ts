import { compare, hash } from "bcrypt";
import { randomUUID } from "node:crypto";
import { sign, type SignOptions } from "jsonwebtoken";
import type { JwtPayload } from "../../core/entities/auth";
import { Role, type Usuario } from "../../core/entities/usuario.entity";
import { InMemoryDatabase } from "../../infrastructure/database/in-memory-db";

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
  private readonly db = InMemoryDatabase.getInstance();
  private readonly jwtSecret = process.env.JWT_SECRET ?? "sist-alici-dev-secret";
  private readonly jwtExpiresIn = process.env.JWT_EXPIRES_IN ?? "8h";

  public listUsers(): LoginResult["user"][] {
    return this.db.users.map((user) => this.toSafeUser(user));
  }

  public findUserById(id: string): Usuario {
    const user = this.db.users.find((item) => item.id === id);
    if (!user) {
      throw new Error("Usuario no encontrado.");
    }
    return user;
  }

  public async registerUser(input: RegisterUserInput): Promise<LoginResult["user"]> {
    const exists = this.db.users.some((user) => user.username.toLowerCase() === input.username.toLowerCase());
    if (exists) {
      throw new Error("El nombre de usuario ya está en uso.");
    }

    const passwordHash = await hash(input.password, 10);
    const nuevo: Usuario = {
      id: `USR-${randomUUID()}`,
      username: input.username.trim(),
      nombre: input.nombre.trim(),
      rol: input.rol,
      passwordHash
    };

    this.db.users.push(nuevo);
    return this.toSafeUser(nuevo);
  }

  public deleteUser(id: string): void {
    const index = this.db.users.findIndex((user) => user.id === id);
    if (index === -1) {
      throw new Error("Usuario no encontrado.");
    }
    this.db.users.splice(index, 1);
  }

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
      user: this.toSafeUser(user)
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
}
