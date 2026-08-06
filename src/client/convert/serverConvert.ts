import type { ConversionOptions, ConversionResult } from "./browserConvert.js";
import { getMessage } from "../i18n/adapter.js";

const TIMEOUT_MS = 30_000;

/** 通过 POST /api/convert 调用后端，含 30s 超时和结构化错误提示 */
export async function serverConvert(
  options: ConversionOptions,
): Promise<ConversionResult> {
  const start = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const formData = new FormData();
  formData.append("file", options.file);
  formData.append("targetFormat", options.targetFormat);
  formData.append("quality", options.quality.toString());
  formData.append("compressionLevel", options.compressionLevel.toString());
  formData.append("lossless", options.lossless.toString());

  try {
    const response = await fetch("/api/convert", {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      // 安全解析错误响应：避免非 JSON 响应（如 nginx 502 HTML 页）崩溃
      let serverMsg = "";
      const contentType = response.headers.get("Content-Type") ?? "";
      if (contentType.includes("application/json")) {
        try {
          const err = (await response.json()) as { error?: string };
          serverMsg = err.error ?? "";
        } catch {
          // JSON 解析失败时静默回退
        }
      }
      const statusMsg = getMessage("backendError").replace(
        "{status}",
        String(response.status),
      );
      throw new Error(serverMsg ? `${statusMsg}: ${serverMsg}` : statusMsg);
    }

    const blob = await response.blob();
    const processorUsed = (response.headers.get("X-Processor-Used") ?? "sharp") as
      | "sharp"
      | "jimp";
    return { blob, processorUsed, durationMs: performance.now() - start };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(getMessage("connectionTimeout"));
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

