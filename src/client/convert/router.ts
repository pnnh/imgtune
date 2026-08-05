import type { ConversionOptions, ConversionResult } from "./browserConvert.js";
import { browserConvert } from "./browserConvert.js";
import type { CapabilityMatrix } from "./capabilities.js";
import { getMessage } from "../i18n/adapter.js";
import { serverConvert } from "./serverConvert.js";

/** 根据能力矩阵选择转换策略并执行 */
export async function routeConversion(
  options: ConversionOptions,
  matrix: CapabilityMatrix,
): Promise<ConversionResult> {
  // 从 file.type 提取并规范化输入格式
  const rawMime = options.file.type.split("/")[1] ?? "jpeg";
  const input = rawMime === "jpg" ? "jpeg" : rawMime;
  const key = `${input}→${options.targetFormat}`;
  const capability = matrix[key] ?? { strategy: "browser" as const };

  if (capability.strategy === "unavailable") {
    throw new Error(
      `${getMessage("conversionFailed")}: format not supported in this environment`,
    );
  }

  if (import.meta.env.OFFLINE || capability.strategy === "browser") {
    return browserConvert(options);
  }

  // 服务端路径（GIF 输出，非 OFFLINE 模式）—— OFFLINE 构建时被 tree-shaking 消除
  return serverConvert(options);
}
