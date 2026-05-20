import { NextRequest, NextResponse } from "next/server";
import { Jimp } from "jimp";
import sharp from "sharp";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const targetFormat = formData.get("targetFormat") as string | null;

        if (!file) {
            return NextResponse.json({ error: "No image file uploaded" }, { status: 400 });
        }

        if (!targetFormat) {
            return NextResponse.json({ error: "No target format specified" }, { status: 400 });
        }

        const allowedFormats = ["jpg", "jpeg", "png", "webp", "gif"];
        const normalizedTarget = targetFormat.toLowerCase() === "jpg" ? "jpeg" : targetFormat.toLowerCase();

        if (!allowedFormats.includes(targetFormat.toLowerCase())) {
            return NextResponse.json({ error: `Unsupported target format: ${targetFormat}` }, { status: 400 });
        }

        // File size check: 10MB limit
        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json({ error: "File is too large. Maximum size is 10MB" }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const sourceMime = file.type.toLowerCase();
        const targetMime = `image/${normalizedTarget}`;

        // Parameters
        const quality = Math.min(100, Math.max(1, parseInt(formData.get("quality") as string || "80", 10)));
        const lossless = formData.get("lossless") as string === "true";
        const compressionLevel = Math.min(9, Math.max(0, parseInt(formData.get("compressionLevel") as string || "6", 10)));

        // Determine processor:
        // Use Jimp if both source and target are JPG/PNG (to reduce native server dependency computation)
        const isJimpSupportedMime = (mime: string) => {
            return ["image/jpeg", "image/jpg", "image/png"].includes(mime);
        };

        const useJimp = isJimpSupportedMime(sourceMime) && isJimpSupportedMime(targetMime);

        let outputBuffer: Buffer;
        let processorUsed = "sharp";

        if (useJimp) {
            try {
                processorUsed = "jimp";
                const image = await Jimp.read(buffer);
                
                // Note: In Jimp v1+, quality and options are passed in getBuffer options object.
                const jimpOptions: any = {};
                if (normalizedTarget === "jpeg") {
                    jimpOptions.quality = quality;
                }
                
                outputBuffer = await image.getBuffer(targetMime as any, jimpOptions);
            } catch (jimpError: any) {
                console.error("Jimp conversion failed, falling back to Sharp:", jimpError);
                // Fallback to Sharp if Jimp fails
                processorUsed = "sharp (fallback)";
                let pipeline = sharp(buffer);
                if (normalizedTarget === "jpeg") {
                    pipeline = pipeline.jpeg({ quality });
                } else if (normalizedTarget === "png") {
                    pipeline = pipeline.png({ compressionLevel });
                }
                outputBuffer = await pipeline.toBuffer();
            }
        } else {
            // Use Sharp for WebP, GIF, or when Jimp isn't supported
            processorUsed = "sharp";
            let pipeline = sharp(buffer);

            if (normalizedTarget === "webp") {
                pipeline = pipeline.webp({ quality, lossless });
            } else if (normalizedTarget === "png") {
                pipeline = pipeline.png({ compressionLevel });
            } else if (normalizedTarget === "gif") {
                pipeline = pipeline.gif(); // Keeps animations intact
            } else if (normalizedTarget === "jpeg") {
                pipeline = pipeline.jpeg({ quality });
            }

            outputBuffer = await pipeline.toBuffer();
        }

        // Return the converted binary file
        const response = new NextResponse(new Uint8Array(outputBuffer), {
            status: 200,
            headers: {
                "Content-Type": targetMime,
                "Content-Length": outputBuffer.length.toString(),
                "X-Processor-Used": processorUsed,
            },
        });
        return response;

    } catch (error: any) {
        console.error("Image conversion error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to process image conversion" },
            { status: 500 }
        );
    }
}
