export type RuntimeType = "web" | "pwa" | "extension" | "webview";

export interface RuntimeContext {
  type: RuntimeType;
  hasBackend: boolean;
}

const RUNTIME_COOKIE = "imgtune-runtime";
const RUNTIME_SESSION_KEY = "imgtune-runtime";

/** 读取并清除 runtime Cookie，写入 sessionStorage */
function consumeRuntimeCookie(): string | null {
  if (typeof document === "undefined") return null;

  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${RUNTIME_COOKIE}=`));

  if (!match) return null;

  const value = match.split("=")[1];
  // 写入 sessionStorage 供后续使用
  try {
    sessionStorage.setItem(RUNTIME_SESSION_KEY, value);
  } catch {
    // 静默失败
  }
  // 立即清除 Cookie
  document.cookie = `${RUNTIME_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  return value;
}

/** 检测运行环境（4 级优先级） */
export function detectRuntimeContext(): RuntimeContext {
  // ① Chrome 扩展：extension 可通过 host_permissions 访问外部 API
  if (typeof chrome !== "undefined" && typeof chrome?.runtime?.id === "string") {
    return { type: "extension", hasBackend: true };
  }

  // ② Webview：Cookie 或 sessionStorage 中的 runtime 标识
  const cookieValue = consumeRuntimeCookie();
  const sessionValue =
    cookieValue ??
    (typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem(RUNTIME_SESSION_KEY)
      : null);

  if (sessionValue === "webview") {
    // webview 可访问父 App 内嵌后端服务
    return { type: "webview", hasBackend: true };
  }

  // ③ PWA standalone 模式
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(display-mode: standalone)").matches
  ) {
    return { type: "pwa", hasBackend: true };
  }

  // ④ 普通 Web
  return { type: "web", hasBackend: true };
}
