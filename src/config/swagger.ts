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
    ],
    components: {
      schemas: {
        Identifiable: {
          type: "object",
          properties: {
            id: { type: "string", example: "INS-HAR-50KG" }
          }
        },
        Insumo: {
          allOf: [
            { $ref: "#/components/schemas/Identifiable" },
            {
              type: "object",
              properties: {
                nombre: { type: "string" },
                unidad: { type: "string", example: "saco" },
                stock: { type: "number", format: "double" },
                costoPromedio: { type: "number", format: "double" }
              }
            }
          ]
        },
        PurchaseRequest: {
          type: "object",
          required: ["insumoId", "cantidad", "costoTotal"],
          properties: {
            insumoId: { type: "string" },
            cantidad: { type: "number", example: 10 },
            costoTotal: { type: "number", example: 500 }
          }
        },
        PurchaseResponse: {
          type: "object",
          properties: {
            data: { $ref: "#/components/schemas/Insumo" }
          }
        },
        InsumoListResponse: {
          type: "object",
          properties: {
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/Insumo" }
            }
          }
        },
        RecetaItem: {
          type: "object",
          properties: {
            insumoId: { type: "string" },
            cantidad: { type: "number" }
          }
        },
        Receta: {
          allOf: [
            { $ref: "#/components/schemas/Identifiable" },
            {
              type: "object",
              properties: {
                productoId: { type: "string" },
                costoManoObra: { type: "number" },
                items: {
                  type: "array",
                  items: { $ref: "#/components/schemas/RecetaItem" }
                }
              }
            }
          ]
        },
        RecetaListResponse: {
          type: "object",
          properties: {
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/Receta" }
            }
          }
        },
        ProductionRequest: {
          type: "object",
          required: ["recetaId", "cantidad"],
          properties: {
            recetaId: { type: "string" },
            cantidad: { type: "integer", example: 5 }
          }
        },
        ProductionResponse: {
          type: "object",
          properties: {
            data: {
              type: "object",
              properties: {
                id: { type: "string" },
                recetaId: { type: "string" },
                productoId: { type: "string" },
                cantidadProducida: { type: "integer" },
                costoIngredientes: { type: "number" },
                costoManoObra: { type: "number" },
                costoTotal: { type: "number" },
                fecha: { type: "string", format: "date-time" }
              }
            }
          }
        },
        VentaItem: {
          type: "object",
          properties: {
            productoId: { type: "string" },
            cantidad: { type: "integer" },
            precioUnitario: { type: "number" }
          }
        },
        DetallePago: {
          type: "object",
          properties: {
            moneda: { type: "string", example: "NIO" },
            cantidad: { type: "number" },
            tasa: { type: "number", nullable: true }
          }
        },
        Venta: {
          allOf: [
            { $ref: "#/components/schemas/Identifiable" },
            {
              type: "object",
              properties: {
                totalNIO: { type: "number" },
                pagos: {
                  type: "array",
                  items: { $ref: "#/components/schemas/DetallePago" }
                },
                items: {
                  type: "array",
                  items: { $ref: "#/components/schemas/VentaItem" }
                },
                fecha: { type: "string", format: "date-time" }
              }
            }
          ]
        },
        SalesCheckoutRequest: {
          type: "object",
          required: ["items", "pagos"],
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                required: ["productoId", "cantidad"],
                properties: {
                  productoId: { type: "string" },
                  cantidad: { type: "integer" }
                }
              }
            },
            pagos: {
              type: "array",
              items: { $ref: "#/components/schemas/DetallePago" }
            }
          }
        },
        SalesCheckoutResponse: {
          type: "object",
          properties: {
            data: { $ref: "#/components/schemas/Venta" },
            cambio: { type: "number" }
          }
        },
        ErrorResponse: {
          type: "object",
          properties: {
            error: { type: "string" },
            details: {
              type: "object",
              nullable: true
            }
          }
        }
      }
    }
  },
  apis: ["./src/infrastructure/web/controllers/*.ts"]
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);
