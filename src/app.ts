import cors from "cors";
import express, { Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";
import { authRouter } from "./infrastructure/web/controllers/auth.controller";
import { configRouter } from "./infrastructure/web/controllers/config.controller";
import { inventoryRouter } from "./infrastructure/web/controllers/inventory.controller";
import { productionRouter } from "./infrastructure/web/controllers/production.controller";
import { salesRouter } from "./infrastructure/web/controllers/sales.controller";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/api/auth", authRouter);
app.use("/api/config", configRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/production", productionRouter);
app.use("/api/sales", salesRouter);

app.get("/health", (_req: Request, res: Response) => {
	res.json({ status: "ok" });
});

export { app };
