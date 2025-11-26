import { createClient, type Client } from "@libsql/client";

let tursoClient: Client | null = null;

export const getTursoClient = (): Client => {
  if (tursoClient) {
    return tursoClient;
  }

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error("Missing TURSO_DATABASE_URL environment variable.");
  }

  if (!authToken) {
    throw new Error("Missing TURSO_AUTH_TOKEN environment variable.");
  }

  tursoClient = createClient({ url, authToken });
  return tursoClient;
};
