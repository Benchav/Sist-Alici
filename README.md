# SIST-ALICI ERP API

API productiva para el ERP de Panadería SIST-ALICI ejecutada en Node.js/TypeScript, con persistencia en **Turso (LibSQL)** y despliegue serverless en **Vercel** (`https://sist-alici.vercel.app`). Centraliza inventario, producción, ventas, configuración y reportes con seguridad JWT y documentación Swagger auto-generada.

## Características principales
- **Arquitectura modular** separando entidades, servicios, controladores, reportes y middlewares.
- **Base de datos Turso (LibSQL)** con consultas parametrizadas y transacciones compartidas.
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
- Turso / LibSQL + `@libsql/client`
- Vercel (`@vercel/node`) como target de despliegue

## Estructura del proyecto (extracto)
```
src/
   app.ts                  # Configuración Express en modo reusable (sin listen)
   index.ts                # Entry point para Vercel/Serverless
  config/swagger.ts       # Swagger options & schema definitions
  application/services/   # Core domain services (auth, inventory, production, sales)
  infrastructure/
      database/turso.ts     # Cliente compartido y helper de transacciones
    reports/{pdf,excel}.service.ts
    web/controllers/*.ts
    web/middlewares/auth.middleware.ts
  core/
    entities/*.ts
    data/seed-data.ts
      utils/currency.ts     # Helpers para operar montos en centavos
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
3. **Compilar y ejecutar el bundle para producción local**
   ```bash
   npm run build
   npm start
   ```
4. **Despliegue serverless (Vercel)**
   ```bash
   vercel
   vercel --prod
   ```
4. **Documentación**: abrir `http://localhost:3000/api-docs` (o el puerto configurado).
## Variables de entorno
| Variable | Valor por defecto | Descripción |
| --- | --- | --- |
| `PORT` | `3000` | Puerto local (no se usa en Vercel). |
| `JWT_SECRET` | `sist-alici-dev-secret` | Secreto para firmar tokens. |
| `JWT_EXPIRES_IN` | `8h` | Duración del token JWT. |
| `TASA_CAMBIO_BASE` | `36.6` (seed) | Sobrescribe la tasa usada al iniciar/checkout. |
| `TURSO_DATABASE_URL` | _obligatoria_ | URL LibSQL provista por Turso. |
| `TURSO_AUTH_TOKEN` | _obligatoria_ | Token de autenticación Turso. |

_Los valores se leen con `dotenv` en `app.ts`. Ajusta `.env` según tus necesidades._

## Scripts npm
| Script | Descripción |
| --- | --- |
| `npm run dev` | Inicia Express con tsx en modo observación. |
| `npm run build` | Compila TypeScript a `dist/`. |
| `npm start` | Ejecuta la app compilada (`dist/server.js`). |
| `npm run lint` | Revisa tipos sin generar archivos. |
| `vercel`, `vercel --prod` | Despliegue serverless (opcional). |

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
Definidos en `src/core/data/seed-data.ts` (hash de contraseña = `123456`). Además, existe un script temporal (`npm run seed:api`) que se usa localmente para poblar Turso durante QA (no se despliega).
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

## Autor
- Nombre: **Joshua Chávez**
- Portafolio: https://joshuachavl.vercel.app