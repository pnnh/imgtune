import type { ConversionOptions, ConversionResult } from "./browserConvert.js";
import { getMessage } from "../i18n/adapter.js";

/**
 * 通过 POST /api/convert 调用后端 Express + Sharp/Jimp 转换。
 * 此模块在 import.meta.env.OFFLINE === true 时被 Rollup tree-shaking 消除。
 */
export async function serverConvert(
  options: ConversionOptions,
): Promise<ConversionResult> {
  const start = performance.now();
  const formData = new FormData();
  formData.append("file", options.file);
  formData.append("targetFormat", options.targetFormat);
  formData.append("quality", options.quality.toString());
  formData.append("compressionLevel", options.compressionLevel.toString());
  formData.append("lossless", options.lossless.toString());

  const response = await fetch("/api/convert", { method: "POST", body: formData });
  if (!response.ok) {
    const err = (await response.json()) as { error?: string };
    throw new Error(err.error ?? getMessage("conversionFailed"));
  }

  const blob = await response.blob();
  const processorUsed = (response.headers.get("X-Processor-Used") ?? "sharp") as
    | "sharp"
    | "jimp";
  return { blob, processorUsed, durationMs: performance.now() - start };
}
