import { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";

// 开发时从 src/server/routes/ 出发，生产时从 dist-server/routes/ 出发，两者相对项目根的位置不同
// 使用 process.cwd() 保持与 package.json 根目录对齐
const DIST_DIR = path.resolve(process.cwd(), "dist");

/** 处理 ?runtime= 参数：设置 Cookie + 302 重定向到不含该参数的 URL */
function handleRuntimeParam(req: Request, res: Response): boolean {
  const runtime = req.query.runtime as string | undefined;
  if (!runtime) return false;

  // 设置 Cookie，HttpOnly=false 以便前端读取
  res.cookie("imgtune-runtime", runtime, {
    sameSite: "lax",
    path: "/",
    maxAge: 3600,
    httpOnly: false,
  });

  // 302 重定向至不含 runtime 参数的同路径 URL
  const redirectUrl = new URL(req.url, `http://${req.headers.host}`);
  redirectUrl.searchParams.delete("runtime");
  res.redirect(302, redirectUrl.pathname + (redirectUrl.search || ""));
  return true;
}

/** 自定义静态资产中间件：静态文件直接返回，其余路径返回 index.html（SPA fallback） */
export function staticHandler(req: Request, res: Response, next: NextFunction): void {
  if (handleRuntimeParam(req, res)) return;

  const reqPath = req.path;

  // 有文件扩展名 → 静态资产
  if (path.extname(reqPath)) {
    const filePath = path.join(DIST_DIR, reqPath);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      next();
    }
    return;
  }

  // 其余路径 → SPA index.html
  const indexPath = path.join(DIST_DIR, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(503).json({ error: "Frontend not built. Run pnpm build:web first." });
  }
}
