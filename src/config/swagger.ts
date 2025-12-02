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
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      },
      schemas: {
        Identifiable: {
          type: "object",
          properties: {
            id: { type: "string", example: "INS-HAR-50KG" }
          }
        },
        SystemConfig: {
          type: "object",
          properties: {
            tasaCambio: { type: "number", example: 36.6 }
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
                costoPromedio: { type: "number", format: "double" },
                proveedorPrincipalId: { type: "string", nullable: true }
              }
            }
          ]
        },
        InsumoRequest: {
          type: "object",
          required: ["nombre", "unidad"],
          properties: {
            nombre: { type: "string", example: "Harina integral" },
            unidad: { type: "string", example: "kg" },
            stock: { type: "number", example: 20 },
            costoPromedio: { type: "number", example: 550 },
            proveedorPrincipalId: { type: "string", nullable: true }
          }
        },
        InsumoUpdateRequest: {
          allOf: [{ $ref: "#/components/schemas/InsumoRequest" }]
        },
        InsumoResponse: {
          type: "object",
          properties: {
            data: { $ref: "#/components/schemas/Insumo" }
          }
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
        FinishedGoodsPurchaseRequest: {
          type: "object",
          required: ["productoId", "cantidad", "costoTotal"],
          properties: {
            productoId: { type: "string" },
            cantidad: { type: "number", example: 25 },
            costoTotal: { type: "number", example: 7500 }
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
                rendimientoBase: { type: "integer", minimum: 1 },
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
        RecetaResponse: {
          type: "object",
          properties: {
            data: { $ref: "#/components/schemas/Receta" }
          }
        },
        ProductionRequest: {
          type: "object",
          required: ["recetaId", "tandas"],
          properties: {
            recetaId: { type: "string" },
            tandas: { type: "integer", example: 5 }
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
        Producto: {
          allOf: [
            { $ref: "#/components/schemas/Identifiable" },
            {
              type: "object",
              properties: {
                nombre: { type: "string" },
                stockDisponible: { type: "number" },
                precioUnitario: { type: "number" },
                precioVenta: { type: "number" },
                categoriaId: { type: "string", nullable: true }
              }
            }
          ]
        },
        CrearProductoRequest: {
          type: "object",
          required: ["nombre"],
          properties: {
            nombre: { type: "string" },
            stockDisponible: { type: "number" },
            precioUnitario: { type: "number" },
            precioVenta: { type: "number" },
            categoriaId: { type: "string", nullable: true }
          }
        },
        ActualizarProductoRequest: {
          allOf: [{ $ref: "#/components/schemas/CrearProductoRequest" }]
        },
        ProductoResponse: {
          type: "object",
          properties: {
            data: { $ref: "#/components/schemas/Producto" }
          }
        },
        ProductoListResponse: {
          type: "object",
          properties: {
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/Producto" }
            }
          }
        },
        Categoria: {
          allOf: [
            { $ref: "#/components/schemas/Identifiable" },
            {
              type: "object",
              properties: {
                nombre: { type: "string" },
                tipo: { type: "string", enum: ["PRODUCCION", "REVENTA", "INSUMO"] }
              }
            }
          ]
        },
        CategoriaRequest: {
          type: "object",
          required: ["nombre", "tipo"],
          properties: {
            nombre: { type: "string" },
            tipo: { type: "string", enum: ["PRODUCCION", "REVENTA", "INSUMO"] }
          }
        },
        CategoriaUpdateRequest: {
          allOf: [{ $ref: "#/components/schemas/CategoriaRequest" }]
        },
        CategoriaResponse: {
          type: "object",
          properties: {
            data: { $ref: "#/components/schemas/Categoria" }
          }
        },
        CategoriaListResponse: {
          type: "object",
          properties: {
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/Categoria" }
            }
          }
        },
        Proveedor: {
          allOf: [
            { $ref: "#/components/schemas/Identifiable" },
            {
              type: "object",
              properties: {
                nombre: { type: "string" },
                frecuenciaCredito: { type: "string", nullable: true },
                contacto: { type: "string", nullable: true }
              }
            }
          ]
        },
        ProveedorRequest: {
          type: "object",
          required: ["nombre"],
          properties: {
            nombre: { type: "string" },
            frecuenciaCredito: { type: "string", nullable: true },
            contacto: { type: "string", nullable: true }
          }
        },
        ProveedorUpdateRequest: {
          allOf: [{ $ref: "#/components/schemas/ProveedorRequest" }]
        },
        ProveedorResponse: {
          type: "object",
          properties: {
            data: { $ref: "#/components/schemas/Proveedor" }
          }
        },
        ProveedorListResponse: {
          type: "object",
          properties: {
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/Proveedor" }
            }
          }
        },
        Descarte: {
          allOf: [
            { $ref: "#/components/schemas/Identifiable" },
            {
              type: "object",
              properties: {
                productoId: { type: "string" },
                cantidad: { type: "integer" },
                motivo: { type: "string", nullable: true },
                fecha: { type: "string", format: "date-time" }
              }
            }
          ]
        },
        EncargoItem: {
          allOf: [
            { $ref: "#/components/schemas/Identifiable" },
            {
              type: "object",
              properties: {
                encargoId: { type: "string" },
                productoId: { type: "string" },
                cantidad: { type: "integer" },
                precioEstimadoCents: { type: "integer" }
              }
            }
          ]
        },
        EncargoAbono: {
          allOf: [
            { $ref: "#/components/schemas/Identifiable" },
            {
              type: "object",
              properties: {
                encargoId: { type: "string" },
                montoCents: { type: "integer" },
                fecha: { type: "string", format: "date-time" },
                medioPago: { type: "string", nullable: true }
              }
            }
          ]
        },
        Encargo: {
          allOf: [
            { $ref: "#/components/schemas/Identifiable" },
            {
              type: "object",
              properties: {
                cliente: { type: "string" },
                fechaEntrega: { type: "string", format: "date-time" },
                totalEstimadoCents: { type: "integer" },
                estado: { type: "string", enum: ["PENDIENTE", "ENTREGADO", "CANCELADO"] },
                ventaId: { type: "string", nullable: true },
                createdAt: { type: "string", format: "date-time", nullable: true },
                items: {
                  type: "array",
                  items: { $ref: "#/components/schemas/EncargoItem" }
                },
                abonos: {
                  type: "array",
                  items: { $ref: "#/components/schemas/EncargoAbono" }
                }
              }
            }
          ]
        },
        EncargoRequest: {
          type: "object",
          required: ["cliente", "fechaEntrega", "items"],
          properties: {
            cliente: { type: "string" },
            fechaEntrega: { type: "string", format: "date-time" },
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
            }
          }
        },
        EncargoDepositRequest: {
          type: "object",
          required: ["monto"],
          properties: {
            monto: { type: "number" },
            medioPago: { type: "string", nullable: true }
          }
        },
        EncargoFinalizeRequest: {
          type: "object",
          properties: {
            pagos: {
              type: "array",
              items: { $ref: "#/components/schemas/DetallePago" }
            },
            descuento: { type: "number", nullable: true }
          }
        },
        EncargoResponse: {
          type: "object",
          properties: {
            data: { $ref: "#/components/schemas/Encargo" }
          }
        },
        EncargoListResponse: {
          type: "object",
          properties: {
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/Encargo" }
            }
          }
        },
        EncargoFinalizeResponse: {
          type: "object",
          properties: {
            data: { $ref: "#/components/schemas/Venta" },
            encargo: { $ref: "#/components/schemas/Encargo" },
            cambio: { type: "number" }
          }
        },
        UpsertRecetaRequest: {
          type: "object",
          required: ["productoId", "items"],
          properties: {
            id: { type: "string", nullable: true },
            productoId: { type: "string" },
            costoManoObra: { type: "number" },
            rendimientoBase: { type: "integer", minimum: 1 },
            items: {
              type: "array",
              items: { $ref: "#/components/schemas/RecetaItem" }
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
                totalPagadoNIO: { type: "number", nullable: true },
                pagos: {
                  type: "array",
                  items: { $ref: "#/components/schemas/DetallePago" }
                },
                items: {
                  type: "array",
                  items: { $ref: "#/components/schemas/VentaItem" }
                },
                fecha: { type: "string", format: "date-time" },
                estado: { type: "string", nullable: true },
                descuentoNIO: { type: "number", nullable: true },
                tipoVenta: { type: "string", enum: ["DIRECTA", "ENCARGO"], nullable: true },
                encargoId: { type: "string", nullable: true }
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
            },
            descuento: { type: "number", nullable: true }
          }
        },
        SalesCheckoutResponse: {
          type: "object",
          properties: {
            data: { $ref: "#/components/schemas/Venta" },
            cambio: { type: "number" }
          }
        },
        SalesHistoryResponse: {
          type: "object",
          properties: {
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/Venta" }
            }
          }
        },
        SalesDetailResponse: {
          type: "object",
          properties: {
            data: { $ref: "#/components/schemas/Venta" }
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
        },
        UserSummary: {
          type: "object",
          properties: {
            id: { type: "string" },
            nombre: { type: "string" },
            username: { type: "string" },
            rol: { type: "string", enum: ["ADMIN", "PANADERO", "CAJERO"] }
          }
        },
        AuthLoginRequest: {
          type: "object",
          required: ["username", "password"],
          properties: {
            username: { type: "string", example: "admin" },
            password: { type: "string", example: "123456" }
          }
        },
        AuthLoginResponse: {
          type: "object",
          properties: {
            token: { type: "string" },
            user: { $ref: "#/components/schemas/UserSummary" }
          }
        },
        AuthRegisterRequest: {
          type: "object",
          required: ["username", "nombre", "password", "rol"],
          properties: {
            username: { type: "string" },
            nombre: { type: "string" },
            password: { type: "string" },
            rol: { type: "string", enum: ["ADMIN", "PANADERO", "CAJERO"] }
          }
        },
        AuthUserResponse: {
          type: "object",
          properties: {
            data: { $ref: "#/components/schemas/UserSummary" }
          }
        },
        AuthUserListResponse: {
          type: "object",
          properties: {
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/UserSummary" }
            }
          }
        }
      }
    }
  },
  apis: ["./src/infrastructure/web/controllers/*.ts"]
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);
