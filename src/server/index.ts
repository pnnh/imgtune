import express, { Request, Response, NextFunction } from "express";
import convertRouter from "./routes/convert.js";
import { staticHandler } from "./routes/static.js";

const app = express();

// JSON body parser（API 路由使用，静态路由不需要）
app.use(express.json());

// API 路由
app.use("/api/convert", convertRouter);

// 静态资产 + SPA fallback（自定义 handler）
app.use(staticHandler);

// 全局错误处理
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : "Internal server error";
  const status = (err as { status?: number }).status ?? 500;
  res.status(status).json({ error: message });
});

const PORT = parseInt(process.env.PORT ?? "3000", 10);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`ImgTune server listening on port ${PORT}`);
});

export default app;
