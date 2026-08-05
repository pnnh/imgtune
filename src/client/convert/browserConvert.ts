import type { ImageFormat } from "./capabilities.js";

export interface ConversionOptions {
  file: File;
  targetFormat: ImageFormat;
  quality: number;
  lossless: boolean;
  compressionLevel: number;
}

export interface ConversionResult {
  blob: Blob;
  processorUsed: "canvas" | "sharp" | "jimp";
  durationMs: number;
}

const MIME_MAP: Record<ImageFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

/** Canvas API 图片格式转换，纯浏览器端，无网络请求 */
export async function browserConvert(
  options: ConversionOptions,
): Promise<ConversionResult> {
  const { file, targetFormat, quality, lossless } = options;
  const start = performance.now();
  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to load image"));
      image.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");

    // PNG/WebP 有透明通道转 JPEG 时填白色背景
    if (targetFormat === "jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0);

    const mimeType = MIME_MAP[targetFormat];
    // PNG 无损（toBlob 不接受质量参数）；lossless WebP 传 1.0
    const qualityParam =
      targetFormat === "png" ? undefined : lossless ? 1.0 : quality / 100;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error("Canvas toBlob returned null")),
        mimeType,
        qualityParam,
      );
    });

    return { blob, processorUsed: "canvas", durationMs: performance.now() - start };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
