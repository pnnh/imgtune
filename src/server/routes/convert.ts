import { Router, Request, Response, NextFunction } from "express";
import { Jimp } from "jimp";
import sharp from "sharp";
import { upload } from "../middleware/upload.js";

const router = Router();

const ALLOWED_FORMATS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

router.post(
  "/",
  upload.single("file"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No image file uploaded" });
        return;
      }

      const targetFormat = (req.body.targetFormat as string | undefined)?.toLowerCase();
      if (!targetFormat) {
        res.status(400).json({ error: "No target format specified" });
        return;
      }

      if (!ALLOWED_FORMATS.has(targetFormat)) {
        res.status(400).json({ error: `Unsupported target format: ${targetFormat}` });
        return;
      }

      const normalizedTarget = targetFormat === "jpg" ? "jpeg" : targetFormat;
      const targetMime = `image/${normalizedTarget}`;
      const sourceMime = req.file.mimetype.toLowerCase();

      const quality = Math.min(100, Math.max(1, parseInt(req.body.quality ?? "80", 10)));
      const lossless = req.body.lossless === "true";
      const compressionLevel = Math.min(9, Math.max(0, parseInt(req.body.compressionLevel ?? "6", 10)));

      const buffer = req.file.buffer;

      // Jimp 优先处理 JPEG↔PNG，Sharp 处理 WebP/GIF 及回退
      const isJimpSupported = (mime: string) =>
        ["image/jpeg", "image/jpg", "image/png"].includes(mime);

      let outputBuffer: Buffer;
      let processorUsed = "sharp";

      if (isJimpSupported(sourceMime) && isJimpSupported(targetMime)) {
        try {
          processorUsed = "jimp";
          const image = await Jimp.read(buffer);
          const opts: Record<string, unknown> = {};
          if (normalizedTarget === "jpeg") opts.quality = quality;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          outputBuffer = await image.getBuffer(targetMime as any, opts as any);
        } catch {
          // 回退到 Sharp
          processorUsed = "sharp (fallback)";
          outputBuffer = await sharpConvert(buffer, normalizedTarget, { quality, compressionLevel, lossless });
        }
      } else {
        outputBuffer = await sharpConvert(buffer, normalizedTarget, { quality, compressionLevel, lossless });
      }

      res
        .status(200)
        .set({
          "Content-Type": targetMime,
          "Content-Length": String(outputBuffer.length),
          "X-Processor-Used": processorUsed,
        })
        .send(outputBuffer);
    } catch (err) {
      next(err);
    }
  }
);

async function sharpConvert(
  input: Buffer,
  format: string,
  opts: { quality: number; compressionLevel: number; lossless: boolean }
): Promise<Buffer> {
  let pipeline = sharp(input);
  if (format === "webp") {
    pipeline = pipeline.webp({ quality: opts.quality, lossless: opts.lossless });
  } else if (format === "png") {
    pipeline = pipeline.png({ compressionLevel: opts.compressionLevel });
  } else if (format === "gif") {
    pipeline = pipeline.gif();
  } else {
    pipeline = pipeline.jpeg({ quality: opts.quality });
  }
  return pipeline.toBuffer();
}

export default router;
