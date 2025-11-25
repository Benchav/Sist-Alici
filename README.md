# SIST-ALICI ERP API

API en memoria que alimenta el ERP de Panadería SIST-ALICI. Centraliza inventario, producción, ventas, configuración y reportes con seguridad JWT y documentación Swagger auto-generada.

## Características principales
- **Arquitectura modular** separando entidades, servicios, controladores, reportes y middlewares.
- **Base de datos en memoria** con datos demo para usuarios, insumos, productos, recetas, ventas y configuración.
- **Autenticación JWT basada en roles** (Admin, Panadero, Cajero) aplicada mediante middleware.
- **Gestión de inventario** con CRUD de insumos y registro de compras.
- **Módulo de producción** para recetas, productos, lotes de fabricación y registro histórico de costos.
- **Módulo de ventas** con pagos en múltiples monedas, anulaciones, facturas PDF y reportes Excel con filtros de fecha.
- **Módulo de configuración** para ajustar la tasa de cambio sin reiniciar el servidor.
- **Documentación Swagger** disponible en `/api-docs` con esquemas de seguridad.

## Tecnologías
- Node.js + TypeScript + Express 5
- Zod para validación de solicitudes
- JSON Web Tokens (`jsonwebtoken`) + `bcrypt`
- `pdfkit` y `exceljs` para reportes
- Swagger (`swagger-jsdoc`, `swagger-ui-express`)

## Estructura del proyecto (extracto)
```
src/
  app.ts                  # Express bootstrap & router wiring
  config/swagger.ts       # Swagger options & schema definitions
  application/services/   # Core domain services (auth, inventory, production, sales)
  infrastructure/
    database/in-memory-db.ts
    reports/{pdf,excel}.service.ts
    web/controllers/*.ts
    web/middlewares/auth.middleware.ts
  core/
    entities/*.ts
    data/seed-data.ts
```

## Puesta en marcha
1. **Instalar dependencias**
   ```bash
   npm install
   ```
2. **Ejecutar en desarrollo (hot-reload con tsx)**
   ```bash
   npm run dev
   ```
3. **Compilar y ejecutar el bundle para producción**
   ```bash
   npm run build
   npm start
   ```
4. **Documentación**: abrir `http://localhost:3000/api-docs` (o el puerto configurado).
## Variables de entorno
| Variable | Valor por defecto | Descripción |
| --- | --- | --- |
| `PORT` | `3000` | Puerto de la API. |
| `JWT_SECRET` | `sist-alici-dev-secret` | Secreto para firmar tokens. |
| `JWT_EXPIRES_IN` | `8h` | Duración del token JWT. |
| `TASA_CAMBIO_BASE` | `36.6` (seed) | Sobrescribe la tasa usada al iniciar/checkout. |

_Los valores se leen con `dotenv` en `app.ts`. Ajusta `.env` según tus necesidades._

## Scripts npm
| Script | Descripción |
| --- | --- |
| `npm run dev` | Inicia Express con tsx en modo observación. |
| `npm run build` | Compila TypeScript a `dist/`. |
| `npm start` | Ejecuta la app compilada (`dist/app.js`). |
| `npm run lint` | Revisa tipos sin generar archivos. |

## Autenticación y roles
- Login vía `POST /api/auth/login` (credenciales en `seed-data.ts`, ej. `admin` / `123456`).
- Usa el `token` retornado para autorizar (`Authorization: Bearer <token>`).
- La verificación de roles ocurre en `auth.middleware.ts` (solo Admin puede actualizar config, exportar Excel o anular ventas).

## Módulos del dominio
### Inventario
- CRUD para `Insumo` y registro de compras.
- Endpoints en `inventory.controller.ts` (mutaciones restringidas a Admin).

### Producción
- CRUD de productos y recetas, registro de lotes y endpoint histórico `GET /api/production/history` (solo Admin).
- `ProductionService` guarda el detalle de costos por lote.

### Ventas
- Checkout con múltiples pagos, conversión según `tasaCambio`, anulaciones, filtros (`from`, `to`), facturas PDF (`GET /api/sales/{id}/pdf`) y exportación Excel (`GET /api/sales/report/excel`).

### Configuración
- `GET /api/config`: consulta la configuración vigente.
- `PUT /api/config`: Admin actualiza la tasa y afecta operaciones futuras al instante.

## Usuarios semilla
Definidos en `src/core/data/seed-data.ts` (hash de contraseña = `123456`).
| Usuario | Rol |
| --- | --- |
| `admin` | ADMIN |
| `panadero` | PANADERO |
| `cajero` | CAJERO |

Usa estas cuentas para pruebas inmediatas.

## Reportes
- **Facturas PDF**: `PdfService` genera comprobantes con `pdfkit`.
- **Reportes Excel**: `ExcelService` resume ventas (ID, fecha, total, pagado, cambio). Los filtros de fecha del endpoint se trasladan al archivo generado.

## Consejos para Swagger
- Swagger UI ya incluye el esquema Bearer. Haz clic en **Authorize** y pega tu token para probar endpoints protegidos.
- Los esquemas (Inventory, Production, Sales, Auth, Config) se definen en `src/config/swagger.ts` para reutilización.

## Próximos pasos sugeridos
- Migrar la base en memoria a un motor persistente (PostgreSQL, Mongo, etc.).
- Añadir pruebas automatizadas (unitarias e integración) para servicios y controladores.
- Configurar CI para lint/build/test.

¡Disfruta construyendo sobre SIST-ALICI ERP!
