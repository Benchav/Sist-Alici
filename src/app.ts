import cors from "cors";
import dotenv from "dotenv";
import express, { Request, Response } from "express";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(cors());
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
	res.json({ status: "ok" });
});

app.listen(port, () => {
	console.log(`SIST-ALICI API running on port ${port}`);
});

export { app };
