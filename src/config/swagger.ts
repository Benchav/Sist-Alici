import swaggerJsdoc, { type Options } from "swagger-jsdoc";

const swaggerOptions: Options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "SIST-ALICI ERP",
      version: "1.0.0",
      description: "API REST in-memory para la gestión del ERP de Panadería SIST-ALICI"
    },
    servers: [
      {
        url: process.env.API_BASE_URL ?? "http://localhost:3000",
        description: "Servidor principal"
      }
    ]
  },
  apis: ["./src/infrastructure/web/controllers/*.ts"]
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);
