export type ImageFormat = "jpeg" | "png" | "webp" | "gif";
export type ConversionStrategy = "browser" | "server" | "unavailable";

export interface FormatCapability {
  strategy: ConversionStrategy;
  /** 非空时在 UI 显示警告（如 GIF 仅第一帧） */
  requiresWarning?: string;
}

/** 键格式: "${inputFormat}→${outputFormat}" */
export type CapabilityMatrix = Record<string, FormatCapability>;

const FORMATS: ImageFormat[] = ["jpeg", "png", "webp", "gif"];

/**
 * 计算当前环境下所有格式转换组合的可用策略。
 * import.meta.env.OFFLINE 在构建时静态替换为布尔字面量。
 */
export function computeCapabilityMatrix(hasBackend: boolean): CapabilityMatrix {
  const matrix: CapabilityMatrix = {};
  for (const input of FORMATS) {
    for (const output of FORMATS) {
      const key = `${input}→${output}`;

      if (output === "gif") {
        // GIF 输出：浏览器无法编码，需要服务端 Sharp
        if (import.meta.env.OFFLINE || !hasBackend) {
          matrix[key] = { strategy: "unavailable" };
        } else {
          matrix[key] = { strategy: "server" };
        }
        continue;
      }

      if (input === "gif") {
        // GIF 输入转非 GIF：浏览器仅第一帧
        matrix[key] = { strategy: "browser", requiresWarning: "gifFirstFrameWarning" };
        continue;
      }

      matrix[key] = { strategy: "browser" };
    }
  }
  return matrix;
}

let webpSupportCache: boolean | null = null;

/** 运行时检测当前浏览器是否支持 WebP 输出（缓存结果） */
export function checkWebPOutputSupport(): Promise<boolean> {
  if (webpSupportCache !== null) return Promise.resolve(webpSupportCache);
  return new Promise<boolean>((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    canvas.toBlob((blob) => {
      webpSupportCache = blob !== null && blob.type === "image/webp";
      resolve(webpSupportCache);
    }, "image/webp");
  });
}
