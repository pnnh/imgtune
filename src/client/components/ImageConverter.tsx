import React, { useState, useEffect, useRef, useMemo, DragEvent, ChangeEvent } from "react";
import { getMessage } from "../i18n/adapter.js";
import { useRuntime } from "../runtime/context.js";
import { routeConversion } from "../convert/router.js";
import { computeCapabilityMatrix, checkWebPOutputSupport } from "../convert/capabilities.js";

type TargetFormat = "jpg" | "png" | "webp" | "gif";

export default function ImageConverter() {
    const { capabilities } = useRuntime();

    const [file, setFile] = useState<File | null>(null);
    const [originalPreviewUrl, setOriginalPreviewUrl] = useState("");
    const [originalDimensions, setOriginalDimensions] = useState<{ width: number; height: number } | null>(null);
    const [targetFormat, setTargetFormat] = useState<TargetFormat>("webp");
    const [quality, setQuality] = useState(80);
    const [compressionLevel, setCompressionLevel] = useState(6);
    const [lossless, setLossless] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const [converting, setConverting] = useState(false);
    const [error, setError] = useState("");
    const [resultBlob, setResultBlob] = useState<Blob | null>(null);
    const [resultUrl, setResultUrl] = useState("");
    const [resultDimensions, setResultDimensions] = useState<{ width: number; height: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [webpSupported, setWebpSupported] = useState<boolean | null>(null);
    const capabilityMatrix = useMemo(
        () => computeCapabilityMatrix(capabilities.hasBackend),
        [capabilities.hasBackend],
    );

    useEffect(() => {
        checkWebPOutputSupport().then(setWebpSupported);
    }, []);

    useEffect(() => {
        return () => {
            if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl);
            if (resultUrl) URL.revokeObjectURL(resultUrl);
        };
    }, [originalPreviewUrl, resultUrl]);

    const handleFileSelect = (selectedFile: File) => {
        if (!selectedFile.type.startsWith("image/")) {
            setError(getMessage("conversionFailed") + ": Only image files are supported");
            return;
        }
        if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl);
        if (resultUrl) { URL.revokeObjectURL(resultUrl); setResultUrl(""); setResultBlob(null); setResultDimensions(null); }
        setError(""); setFile(selectedFile);
        const url = URL.createObjectURL(selectedFile);
        setOriginalPreviewUrl(url);
        const img = new Image();
        img.onload = () => setOriginalDimensions({ width: img.width, height: img.height });
        img.src = url;
        const ext = selectedFile.name.split(".").pop()?.toLowerCase();
        if (ext === "png") setTargetFormat("webp");
        else if (ext === "jpg" || ext === "jpeg") setTargetFormat("png");
        else if (ext === "webp") setTargetFormat("jpg");
        else if (ext === "gif") setTargetFormat("png");
    };

    const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
    };
    const onDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragOver(true); };
    const onDragLeave = () => setIsDragOver(false);
    const onDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault(); setIsDragOver(false);
        if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
    };
    const openFileDialog = () => fileInputRef.current?.click();

    const handleReset = () => {
        setFile(null); setOriginalDimensions(null);
        if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl);
        setOriginalPreviewUrl("");
        if (resultUrl) URL.revokeObjectURL(resultUrl);
        setResultUrl(""); setResultBlob(null); setResultDimensions(null); setError("");
    };

    const handleConvert = async () => {
        if (!file) return;
        setConverting(true); setError("");
        if (resultUrl) { URL.revokeObjectURL(resultUrl); setResultUrl(""); setResultBlob(null); setResultDimensions(null); }
        try {
            const { blob } = await routeConversion(
                { file, targetFormat: targetFormat === "jpg" ? "jpeg" : targetFormat, quality, lossless, compressionLevel },
                capabilityMatrix,
            );
            setResultBlob(blob);
            const url = URL.createObjectURL(blob);
            setResultUrl(url);
            const img = new Image();
            img.onload = () => setResultDimensions({ width: img.width, height: img.height });
            img.src = url;
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : getMessage("conversionFailed"));
        } finally {
            setConverting(false);
        }
    };

    const handleDownload = () => {
        if (!resultBlob || !file) return;
        const name = file.name.substring(0, file.name.lastIndexOf("."));
        const ext = targetFormat === "jpg" ? "jpg" : targetFormat;
        const link = document.createElement("a");
        link.href = resultUrl; link.download = `${name}_converted.${ext}`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024; const sizes = ["Bytes", "KB", "MB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    const savings = (() => {
        if (!file || !resultBlob) return null;
        const diff = file.size - resultBlob.size;
        return { saved: diff > 0, percent: Math.abs((diff / file.size) * 100).toFixed(1), size: formatBytes(Math.abs(diff)) };
    })();

    return (
        <div className="w-full max-w-4xl mx-auto py-4 px-4 sm:px-6 lg:px-8" data-requires-backend>
            <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-100 dark:border-gray-800 shadow-2xl rounded-3xl overflow-hidden p-6 sm:p-8 transition-all duration-300">

                {!file ? (
                    <div
                        onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} onClick={openFileDialog}
                        className={`group border-2 border-dashed rounded-2xl p-10 sm:p-14 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center ${isDragOver ? "border-blue-500 bg-blue-50/50 scale-[0.99] shadow-inner" : "border-gray-200 hover:border-blue-400 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-900/30 hover:shadow-lg"}`}
                    >
                        <input type="file" ref={fileInputRef} onChange={onFileChange} accept="image/*" className="hidden" />
                        <div className="h-16 w-16 rounded-full bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center mb-5 text-blue-500 group-hover:scale-110 transition-transform duration-300">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2 group-hover:text-blue-500">{getMessage("dragDropText")}</h3>
                        <p className="text-sm text-gray-500">{getMessage("supportedFormats")}</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* 源文件预览 */}
                        <div className="relative bg-gray-50/50 dark:bg-gray-950/20 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 flex flex-col md:flex-row gap-6 items-center">
                            <button onClick={handleReset} title={getMessage("closePreview")} className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/90 hover:bg-red-50 hover:text-red-500 text-gray-400 flex items-center justify-center border border-gray-100 shadow-sm transition-all active:scale-95">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                            <div className="w-full md:w-48 h-40 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center border border-gray-200/50 shadow-sm">
                                <img src={originalPreviewUrl} alt="Original" className="max-w-full max-h-full object-contain select-none" />
                            </div>
                            <div className="flex-1 space-y-2 pr-8">
                                <p className="text-base font-semibold text-gray-800 truncate" title={file.name}>{file.name}</p>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div><span className="text-gray-400 block text-xs uppercase tracking-wider mb-0.5">{getMessage("fileSize")}</span><span className="font-semibold text-gray-700">{formatBytes(file.size)}</span></div>
                                    <div><span className="text-gray-400 block text-xs uppercase tracking-wider mb-0.5">{getMessage("dimensions")}</span><span className="font-semibold text-gray-700">{originalDimensions ? `${originalDimensions.width} × ${originalDimensions.height}` : "..."}</span></div>
                                </div>
                            </div>
                        </div>

                        {/* GIF 首帧警告 */}
                        {file?.type === "image/gif" && targetFormat !== "gif" && (
                            <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-3 text-sm">
                                {getMessage("gifFirstFrameWarning")}
                            </div>
                        )}

                        {/* 目标格式选择 */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">{getMessage("selectTargetFormat")}</h3>
                            <div className="grid grid-cols-4 gap-2 bg-gray-50 dark:bg-gray-950/40 p-1.5 rounded-xl border border-gray-100">
                                {(["jpg", "png", "webp", "gif"] as TargetFormat[]).map((f) => {
                                    const inputFmt = (file?.type ?? "image/jpeg").split("/")[1]!.replace(/^jpe?g$/, "jpeg");
                                    const outFmt = f === "jpg" ? "jpeg" : f;
                                    const cap = capabilityMatrix[`${inputFmt}\u2192${outFmt}`] ?? { strategy: "browser" as const };
                                    const disabled = cap.strategy === "unavailable" || (f === "webp" && webpSupported === false);
                                    const title = f === "webp" && webpSupported === false ? getMessage("webpNotSupported") : undefined;
                                    return (
                                        <button
                                            key={f}
                                            onClick={() => !disabled && setTargetFormat(f)}
                                            disabled={disabled}
                                            title={title}
                                            className={`py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${disabled ? "text-gray-300 cursor-not-allowed" : targetFormat === f ? "bg-white text-blue-600 shadow-sm border border-gray-100" : "text-gray-500 hover:text-gray-800"}`}
                                        >
                                            {f.toUpperCase()}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 转换参数 */}
                        <div className="bg-gray-50/50 dark:bg-gray-950/20 border border-gray-100 rounded-2xl p-5">
                            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider mb-4">{getMessage("conversionParameters")}</h3>
                            {(targetFormat === "jpg" || (targetFormat === "webp" && !lossless)) && (
                                <div className="space-y-3 mb-4">
                                    <div className="flex justify-between text-sm font-medium">
                                        <label>{getMessage("quality")}</label>
                                        <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-xs">{quality}</span>
                                    </div>
                                    <input type="range" min="1" max="100" value={quality} onChange={(e) => setQuality(+e.target.value)} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                                </div>
                            )}
                            {targetFormat === "png" && (
                                <div className="space-y-3">
                                    <div className="flex justify-between text-sm font-medium">
                                        <label>{getMessage("compressionLevel")}</label>
                                        <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-xs">Level {compressionLevel}</span>
                                    </div>
                                    <input type="range" min="0" max="9" value={compressionLevel} onChange={(e) => setCompressionLevel(+e.target.value)} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                                </div>
                            )}
                            {targetFormat === "webp" && (
                                <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-2">
                                    <div>
                                        <label htmlFor="lossless-toggle" className="text-sm font-semibold text-gray-700 cursor-pointer">{getMessage("lossless")}</label>
                                    </div>
                                    <input id="lossless-toggle" type="checkbox" checked={lossless} onChange={(e) => setLossless(e.target.checked)} className="w-9 h-5 rounded-full appearance-none cursor-pointer bg-gray-200 checked:bg-blue-600 transition-colors" />
                                </div>
                            )}
                            {targetFormat === "gif" && (
                                <p className="text-sm text-blue-600">{getMessage("defaultSettings")}</p>
                            )}
                        </div>

                        {/* 转换按钮 */}
                        <button onClick={handleConvert} disabled={converting} className={`w-full py-4 rounded-2xl text-white font-semibold text-base shadow-xl flex items-center justify-center gap-3 transition-all active:scale-[0.985] ${converting ? "bg-blue-400 cursor-not-allowed" : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"}`}>
                            {converting ? (
                                <><svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg><span>{getMessage("converting")}</span></>
                            ) : (
                                <span>{getMessage("convertButton")}</span>
                            )}
                        </button>

                        {error && <p className="text-center text-red-500 text-sm">{error}</p>}

                        {/* 转换结果 */}
                        {resultUrl && resultBlob && (
                            <div className="space-y-4">
                                <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                                    <img src={resultUrl} alt="Converted" className="w-full object-contain max-h-64" />
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div><span className="text-gray-400 block text-xs uppercase tracking-wider mb-0.5">{getMessage("fileSize")}</span><span className="font-semibold text-gray-700">{formatBytes(resultBlob.size)}</span></div>
                                    {resultDimensions && <div><span className="text-gray-400 block text-xs uppercase tracking-wider mb-0.5">{getMessage("dimensions")}</span><span className="font-semibold text-gray-700">{resultDimensions.width} × {resultDimensions.height}</span></div>}
                                </div>
                                {savings && (
                                    <p className="text-sm text-green-600">{getMessage("savedSize")}: {savings.size} ({savings.percent}%)</p>
                                )}
                                <button onClick={handleDownload} className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors">
                                    {getMessage("downloadButton")}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
