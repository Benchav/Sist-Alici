import cors from "cors";
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";
import { inventoryRouter } from "./infrastructure/web/controllers/inventory.controller";
import { productionRouter } from "./infrastructure/web/controllers/production.controller";
import { salesRouter } from "./infrastructure/web/controllers/sales.controller";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(cors());
app.use(express.json());

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/api/inventory", inventoryRouter);
app.use("/api/production", productionRouter);
app.use("/api/sales", salesRouter);

app.get("/health", (_req: Request, res: Response) => {
	res.json({ status: "ok" });
});

app.listen(port, () => {
	console.log(`SIST-ALICI API running on port ${port}`);
});

export { app };
