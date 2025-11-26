# SIST-ALICI ERP API

Backend productivo que opera el ERP de la panadería SIST-ALICI. Está construido con Node.js + TypeScript, expone toda la funcionalidad vía Express y persiste datos en **Turso (LibSQL)**. El runtime final vive en **Vercel** (`https://sist-alici.vercel.app`) y aprovecha despliegues serverless para escalar bajo demanda.

## Resumen de capacidades
- Arquitectura en capas (Core, Application, Infrastructure) con responsabilidades bien separadas.
- Persistencia en Turso con un único cliente compartido y helper de transacciones (`withTursoTransaction`).
- Autenticación JWT con roles (Admin, Panadero, Cajero) y middlewares reutilizables.
- Flujos completos para inventario, producción y ventas (incluye pagos multi-moneda, reversas, PDF/Excel).
- Configuración runtime (tasa de cambio) sin necesidad de reiniciar la API.
- Documentación Swagger accesible en `/api-docs` con soporte para tokens Bearer.

## Stack principal
- Node.js 20 + TypeScript + Express 5
- Zod para validaciones y DTOs
- JWT (`jsonwebtoken`) + `bcrypt` para seguridad
- Turso / LibSQL (`@libsql/client`) como base de datos
- PDFKit y ExcelJS para reportes
- Swagger (`swagger-jsdoc`, `swagger-ui-express`)
- Vercel (`@vercel/node`) como plataforma de despliegue

## Estructura
```
src/
  app.ts              # Configuración de Express en modo reusable
  index.ts            # Handler para Vercel (@vercel/node)
  config/swagger.ts   # OpenAPI + componentes compartidos
  application/services/
    auth.service.ts
    inventory.service.ts
    production.service.ts
    sales.service.ts
  infrastructure/
    database/turso.ts # Cliente LibSQL + helper transaccional
    reports/
      excel.service.ts
      pdf.service.ts
    web/controllers/*.ts
    web/middlewares/auth.middleware.ts
  core/
    entities/*.ts
    data/seed-data.ts
    utils/currency.ts # Operaciones monetarias en centavos
```

## Puesta en marcha
1. Instalar dependencias
   ```bash
   npm install
   ```
2. Desarrollo con hot reload
   ```bash
   npm run dev
   ```
3. Build + ejecución local productiva
   ```bash
   npm run build
   npm start
   ```
4. Despliegue en Vercel
   ```bash
   vercel
   vercel --prod
   ```
5. Documentación
   - Local: `http://localhost:3000/api-docs`
   - Producción: `https://sist-alici.vercel.app/api-docs`

## Variables de entorno
| Variable | Requerida | Descripción |
| --- | --- | --- |
| `PORT` | No | Solo para ejecución local (default `3000`). |
| `JWT_SECRET` | Sí | Clave para firmar tokens (debe definirse en `.env` y en Vercel). |
| `JWT_EXPIRES_IN` | No | Tiempo de vida del token (`8h` por defecto). |
| `TASA_CAMBIO_BASE` | No | Valor inicial de la tasa de cambio hasta que exista registro en BD. |
| `TURSO_DATABASE_URL` | Sí | URL LibSQL provista por Turso. |
| `TURSO_AUTH_TOKEN` | Sí | Token JWT que otorga Turso para acceder a la base. |

## Scripts disponibles
| Script | Descripción |
| --- | --- |
| `npm run dev` | Dev server con `tsx --watch`. |
| `npm run build` | Compila TypeScript a `dist/`. |
| `npm start` | Arranca la versión compilada (`dist/server.js`). |
| `npm run lint` | `tsc --noEmit` para validar tipos. |
| `vercel` / `vercel --prod` | Deploy serverless (preprod / prod). |

## Autenticación y roles
- `POST /api/auth/login` entrega JWT (usuarios base en `seed-data.ts`).
- Middlewares `authenticateJWT` y `authorizeRoles` aplican seguridad granular.
- Solo Admin puede registrar usuarios, modificar configuración y generar reportes.

## Módulos funcionales
### Inventario
- CRUD completo de insumos y registro de compras (actualiza stock + costo promedio). 
- Transacciones en centavos para evitar errores de coma flotante.

### Producción
- Gestión de productos, recetas y lotes de fabricación.
- Consume insumos en transacción, actualiza stock y calcula costos por lote.

### Ventas
- Checkout con múltiples pagos (NIO/USD) y cálculo seguro de cambio.
- Historial filtrable (`from`, `to`), generación de factura PDF y reporte Excel.
- Anulación revierte stock en transacción.

### Configuración
- Lectura/actualización de la tasa de cambio sin reiniciar el servicio.

## Usuarios de prueba
Definidos en `src/core/data/seed-data.ts` (contraseña `hash`).

| Usuario | Rol |
| --- | --- |
| `admin` | ADMIN |
| `panadero` | PANADERO |
| `cajero` | CAJERO |

También existe un script local (`npm run seed:api`) que invoca la API desplegada para poblar Turso con datos demo; se usa únicamente en QA y no forma parte del despliegue.

## Reportes
- `PdfService`: genera facturas descargables (`GET /api/sales/:id/pdf`).
- `ExcelService`: exporta ventas filtradas a XLSX (`GET /api/sales/report/excel`).


---
**Autor**: [Joshua Chávez](https://joshuachavl.vercel.app)