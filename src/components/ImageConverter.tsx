"use client";

import { useState, useEffect, useRef, DragEvent, ChangeEvent } from "react";
import type { LangKey } from "@/lib/language";
import { t } from "@/lib/i18n";

type Props = {
    lang: LangKey;
};

type TargetFormat = "jpg" | "png" | "webp" | "gif";

export default function ImageConverter({ lang }: Props) {
    // Files & Previews
    const [file, setFile] = useState<File | null>(null);
    const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string>("");
    const [originalDimensions, setOriginalDimensions] = useState<{ width: number; height: number } | null>(null);

    // Formats & Parameters
    const [targetFormat, setTargetFormat] = useState<TargetFormat>("webp");
    const [quality, setQuality] = useState<number>(80);
    const [compressionLevel, setCompressionLevel] = useState<number>(6);
    const [lossless, setLossless] = useState<boolean>(false);

    // States
    const [isDragOver, setIsDragOver] = useState<boolean>(false);
    const [converting, setConverting] = useState<boolean>(false);
    const [error, setError] = useState<string>("");
    const [resultBlob, setResultBlob] = useState<Blob | null>(null);
    const [resultUrl, setResultUrl] = useState<string>("");
    const [resultDimensions, setResultDimensions] = useState<{ width: number; height: number } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Clean up URLs to prevent memory leaks
    useEffect(() => {
        return () => {
            if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl);
            if (resultUrl) URL.revokeObjectURL(resultUrl);
        };
    }, [originalPreviewUrl, resultUrl]);

    // Handle File selection
    const handleFileSelect = (selectedFile: File) => {
        if (!selectedFile.type.startsWith("image/")) {
            setError(t(lang, "conversionFailed") + ": Only image files are supported");
            return;
        }

        // Revoke old URL if exists
        if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl);
        if (resultUrl) {
            URL.revokeObjectURL(resultUrl);
            setResultUrl("");
            setResultBlob(null);
            setResultDimensions(null);
        }

        setError("");
        setFile(selectedFile);

        const url = URL.createObjectURL(selectedFile);
        setOriginalPreviewUrl(url);

        // Fetch image dimensions
        const img = new Image();
        img.onload = () => {
            setOriginalDimensions({ width: img.width, height: img.height });
        };
        img.src = url;

        // Auto-select target format that is different from original
        const origExt = selectedFile.name.split(".").pop()?.toLowerCase();
        if (origExt === "png") {
            setTargetFormat("webp");
        } else if (origExt === "jpg" || origExt === "jpeg") {
            setTargetFormat("png");
        } else if (origExt === "webp") {
            setTargetFormat("jpg");
        } else if (origExt === "gif") {
            setTargetFormat("png");
        }
    };

    const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    };

    // Drag and Drop
    const onDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const onDragLeave = () => {
        setIsDragOver(false);
    };

    const onDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    };

    const openFileDialog = () => {
        fileInputRef.current?.click();
    };

    // Reset / Clear
    const handleReset = () => {
        setFile(null);
        setOriginalDimensions(null);
        if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl);
        setOriginalPreviewUrl("");
        if (resultUrl) URL.revokeObjectURL(resultUrl);
        setResultUrl("");
        setResultBlob(null);
        setResultDimensions(null);
        setError("");
    };

    // Perform Conversion
    const handleConvert = async () => {
        if (!file) return;

        setConverting(true);
        setError("");
        
        // Revoke old result URL if it exists
        if (resultUrl) {
            URL.revokeObjectURL(resultUrl);
            setResultUrl("");
            setResultBlob(null);
            setResultDimensions(null);
        }

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("targetFormat", targetFormat);
            formData.append("quality", quality.toString());
            formData.append("compressionLevel", compressionLevel.toString());
            formData.append("lossless", lossless.toString());

            const response = await fetch("/api/convert", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || t(lang, "conversionFailed"));
            }

            const blob = await response.blob();
            setResultBlob(blob);

            const url = URL.createObjectURL(blob);
            setResultUrl(url);

            // Fetch result dimensions
            const img = new Image();
            img.onload = () => {
                setResultDimensions({ width: img.width, height: img.height });
            };
            img.src = url;

        } catch (err: any) {
            console.error(err);
            setError(err.message || t(lang, "conversionFailed"));
        } finally {
            setConverting(false);
        }
    };

    // Trigger Download
    const handleDownload = () => {
        if (!resultBlob || !file) return;
        const originalName = file.name.substring(0, file.name.lastIndexOf("."));
        const ext = targetFormat === "jpg" ? "jpg" : targetFormat;
        const newFileName = `${originalName}_converted.${ext}`;

        const link = document.createElement("a");
        link.href = resultUrl;
        link.download = newFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Format utility
    const formatBytes = (bytes: number, decimals = 2) => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ["Bytes", "KB", "MB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
    };

    // Size savings calculation
    const getSavings = () => {
        if (!file || !resultBlob) return null;
        const diff = file.size - resultBlob.size;
        const pct = (diff / file.size) * 100;
        return {
            saved: diff > 0,
            percent: Math.abs(pct).toFixed(1),
            size: formatBytes(Math.abs(diff)),
        };
    };

    const savings = getSavings();

    return (
        <div className="w-full max-w-4xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
            <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-gray-100 dark:border-gray-800 shadow-2xl rounded-3xl overflow-hidden p-6 sm:p-8 transition-all duration-300">
                
                {/* Upload Section / Drag-Drop Area */}
                {!file ? (
                    <div
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                        onClick={openFileDialog}
                        className={`group border-2 border-dashed rounded-2xl p-10 sm:p-14 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center ${
                            isDragOver
                                ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 scale-[0.99] shadow-inner"
                                : "border-gray-200 hover:border-blue-400 bg-gray-50/50 dark:border-gray-800 dark:hover:border-gray-700 dark:bg-gray-900/30 hover:shadow-lg hover:shadow-blue-500/5"
                        }`}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={onFileChange}
                            accept="image/*"
                            className="hidden"
                        />
                        <div className="h-16 w-16 rounded-full bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center mb-5 text-blue-500 group-hover:scale-110 transition-transform duration-300 shadow-sm border border-blue-100/50 dark:border-blue-900/30">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2 transition-colors duration-200 group-hover:text-blue-500">
                            {t(lang, "dragDropText")}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {t(lang, "supportedFormats")}
                        </p>
                    </div>
                ) : (
                    /* Interactive Workspace */
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-500">
                        {/* Image Preview & Details Card */}
                        <div className="relative group/card bg-gray-50/50 dark:bg-gray-950/20 border border-gray-100 dark:border-gray-850/30 rounded-2xl p-5 flex flex-col md:flex-row gap-6 items-center">
                            
                            {/* Reset Button */}
                            <button
                                onClick={handleReset}
                                className="absolute top-4 right-4 md:top-5 md:right-5 h-8 w-8 rounded-full bg-white/90 dark:bg-gray-850 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 text-gray-400 dark:text-gray-500 flex items-center justify-center border border-gray-100 dark:border-gray-800 hover:border-red-100 dark:hover:border-red-900/30 shadow-sm cursor-pointer transition-all active:scale-95 duration-200"
                                title={t(lang, "closePreview")}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>

                            {/* Source Image Rendering */}
                            <div className="w-full md:w-48 h-40 relative rounded-xl bg-gray-100 dark:bg-gray-850 overflow-hidden flex items-center justify-center border border-gray-200/50 dark:border-gray-800/80 shadow-sm">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={originalPreviewUrl}
                                    alt="Original Source Preview"
                                    className="max-w-full max-h-full object-contain drop-shadow-md select-none"
                                />
                            </div>

                            {/* Source Image Details */}
                            <div className="flex-1 w-full text-center md:text-left space-y-2 pr-8">
                                <h4 className="text-base font-semibold text-gray-850 dark:text-gray-100 truncate max-w-xs md:max-w-md" title={file.name}>
                                    {file.name}
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6 pt-1 text-sm">
                                    <div>
                                        <span className="text-gray-450 dark:text-gray-500 block text-xs font-medium uppercase tracking-wider mb-0.5">{t(lang, "fileSize")}</span>
                                        <span className="font-semibold text-gray-700 dark:text-gray-300">{formatBytes(file.size)}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-450 dark:text-gray-500 block text-xs font-medium uppercase tracking-wider mb-0.5">{t(lang, "dimensions")}</span>
                                        <span className="font-semibold text-gray-700 dark:text-gray-300">
                                            {originalDimensions ? `${originalDimensions.width} × ${originalDimensions.height}` : "..."}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Format Selection Component */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-300 uppercase tracking-wider">
                                {t(lang, "selectTargetFormat")}
                            </h3>
                            <div className="grid grid-cols-4 gap-2 bg-gray-50 dark:bg-gray-950/40 p-1.5 rounded-xl border border-gray-100 dark:border-gray-850/50">
                                {(["jpg", "png", "webp", "gif"] as TargetFormat[]).map((format) => (
                                    <button
                                        key={format}
                                        onClick={() => setTargetFormat(format)}
                                        className={`py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-all duration-300 ${
                                            targetFormat === format
                                                ? "bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm border border-gray-100 dark:border-gray-700"
                                                : "text-gray-500 dark:text-gray-450 hover:text-gray-800 dark:hover:text-gray-200"
                                        }`}
                                    >
                                        {format.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Dynamic Parameters panel */}
                        <div className="bg-gray-50/50 dark:bg-gray-950/20 border border-gray-100 dark:border-gray-850/30 rounded-2xl p-5 sm:p-6 transition-all duration-300">
                            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-300 uppercase tracking-wider mb-4">
                                {t(lang, "conversionParameters")}
                            </h3>

                            {/* JPG quality settings */}
                            {targetFormat === "jpg" && (
                                <div className="space-y-3 animate-in fade-in duration-300">
                                    <div className="flex justify-between items-center text-sm font-medium">
                                        <label htmlFor="jpg-quality" className="text-gray-600 dark:text-gray-400">{t(lang, "quality")}</label>
                                        <span className="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded-md text-xs font-semibold">{quality}</span>
                                    </div>
                                    <input
                                        id="jpg-quality"
                                        type="range"
                                        min="1"
                                        max="100"
                                        value={quality}
                                        onChange={(e) => setQuality(parseInt(e.target.value))}
                                        className="w-full h-1.5 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    />
                                    <div className="flex justify-between text-[11px] text-gray-400 dark:text-gray-500">
                                        <span>Small Size (1)</span>
                                        <span>Balanced (80)</span>
                                        <span>Max Quality (100)</span>
                                    </div>
                                </div>
                            )}

                            {/* PNG settings */}
                            {targetFormat === "png" && (
                                <div className="space-y-3 animate-in fade-in duration-300">
                                    <div className="flex justify-between items-center text-sm font-medium">
                                        <label htmlFor="png-compression" className="text-gray-600 dark:text-gray-400">{t(lang, "compressionLevel")}</label>
                                        <span className="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded-md text-xs font-semibold">Level {compressionLevel}</span>
                                    </div>
                                    <input
                                        id="png-compression"
                                        type="range"
                                        min="0"
                                        max="9"
                                        value={compressionLevel}
                                        onChange={(e) => setCompressionLevel(parseInt(e.target.value))}
                                        className="w-full h-1.5 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    />
                                    <div className="flex justify-between text-[11px] text-gray-400 dark:text-gray-500">
                                        <span>Fast / Large (0)</span>
                                        <span>Default (6)</span>
                                        <span>Slow / Small (9)</span>
                                    </div>
                                </div>
                            )}

                            {/* WEBP quality and lossless toggle */}
                            {targetFormat === "webp" && (
                                <div className="space-y-5 animate-in fade-in duration-300">
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center text-sm font-medium">
                                            <label htmlFor="webp-quality" className="text-gray-600 dark:text-gray-400">{t(lang, "quality")}</label>
                                            <span className={`text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded-md text-xs font-semibold ${lossless ? "opacity-30" : ""}`}>
                                                {lossless ? "N/A" : quality}
                                            </span>
                                        </div>
                                        <input
                                            id="webp-quality"
                                            type="range"
                                            min="1"
                                            max="100"
                                            value={quality}
                                            disabled={lossless}
                                            onChange={(e) => setQuality(parseInt(e.target.value))}
                                            className={`w-full h-1.5 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500 ${lossless ? "opacity-35 cursor-not-allowed" : ""}`}
                                        />
                                        <div className="flex justify-between text-[11px] text-gray-400 dark:text-gray-500">
                                            <span>Small Size (1)</span>
                                            <span>Balanced (80)</span>
                                            <span>Max Quality (100)</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between border-t border-gray-100/50 dark:border-gray-850/50 pt-4">
                                        <div className="flex flex-col">
                                            <label htmlFor="lossless-toggle" className="text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer">
                                                {t(lang, "lossless")}
                                            </label>
                                            <span className="text-xs text-gray-400 dark:text-gray-500">Enable absolute pixel-perfect output (larger file)</span>
                                        </div>
                                        <input
                                            id="lossless-toggle"
                                            type="checkbox"
                                            checked={lossless}
                                            onChange={(e) => setLossless(e.target.checked)}
                                            className="w-9 h-5 rounded-full appearance-none cursor-pointer bg-gray-200 dark:bg-gray-800 relative checked:bg-blue-600 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform checked:after:translate-x-4 border border-transparent"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* GIF settings */}
                            {targetFormat === "gif" && (
                                <div className="flex items-center gap-3 p-4 bg-blue-50/30 dark:bg-blue-950/10 border border-blue-100/20 dark:border-blue-900/10 rounded-xl animate-in fade-in duration-300 text-blue-600/90 dark:text-blue-400/90">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5 flex-shrink-0">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 11.517 1.282l-.517-.262zm0 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm0 0v8.25M12 3a9 9 0 110 18 9 9 0 010-18z" />
                                    </svg>
                                    <span className="text-sm font-medium">
                                        {t(lang, "defaultSettings")}. Animated frame tracks will be fully preserved during encoding.
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Execute Button */}
                        <div className="pt-2">
                            <button
                                onClick={handleConvert}
                                disabled={converting}
                                className={`w-full py-4.5 rounded-2xl text-white font-semibold text-base shadow-xl flex items-center justify-center gap-3 transition-all active:scale-[0.985] cursor-pointer ${
                                    converting
                                        ? "bg-blue-400 dark:bg-blue-600/50 cursor-not-allowed"
                                        : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:shadow-blue-500/20 hover:shadow-2xl"
                                }`}
                            >
                                {converting ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span>{t(lang, "converting")}</span>
                                    </>
                                ) : (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                        </svg>
                                        <span>{t(lang, "convertButton")}</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Error Alert Display */}
                        {error && (
                            <div className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 text-red-650 dark:text-red-400 p-4.5 rounded-2xl flex items-start gap-3 animate-in fade-in duration-300">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5.5 h-5.5 flex-shrink-0 mt-0.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                </svg>
                                <div className="space-y-1">
                                    <h4 className="font-semibold text-sm leading-tight">{t(lang, "conversionFailed")}</h4>
                                    <p className="text-xs opacity-90 leading-normal">{error}</p>
                                </div>
                            </div>
                        )}

                        {/* Result Output Preview Card */}
                        {resultUrl && resultBlob && (
                            <div className="border border-green-100/50 dark:border-green-900/20 bg-green-50/20 dark:bg-green-950/5 rounded-3xl p-6 sm:p-8 space-y-6 animate-in fade-in slide-in-from-bottom-5 duration-500">
                                <div className="flex items-center gap-3 text-green-600 dark:text-green-400">
                                    <div className="h-8 w-8 rounded-full bg-green-50 dark:bg-green-950/50 border border-green-150/40 dark:border-green-900/30 flex items-center justify-center text-green-500">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                        </svg>
                                    </div>
                                    <h3 className="font-bold text-base sm:text-lg">{t(lang, "conversionSuccess")}</h3>
                                </div>

                                <div className="flex flex-col md:flex-row gap-8 items-center">
                                    {/* Result image rendering */}
                                    <div className="w-full md:w-64 h-56 relative rounded-2xl bg-gray-100 dark:bg-gray-850/80 overflow-hidden flex items-center justify-center border border-gray-200/50 dark:border-gray-800/80 shadow-md">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={resultUrl}
                                            alt="Converted Output Preview"
                                            className="max-w-full max-h-full object-contain drop-shadow-md select-none"
                                        />
                                    </div>

                                    {/* Size comparisons & download */}
                                    <div className="flex-1 w-full space-y-5">
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 pt-1 text-sm">
                                            <div>
                                                <span className="text-gray-450 dark:text-gray-500 block text-xs font-medium uppercase tracking-wider mb-0.5">{t(lang, "fileSize")}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-gray-750 dark:text-gray-300 text-base">{formatBytes(resultBlob.size)}</span>
                                                    {savings && (
                                                        <span className={`text-[10px] px-1.5 py-0.5 font-bold rounded-md uppercase tracking-wider ${
                                                            savings.saved
                                                                ? "bg-green-105/10 text-green-600 dark:bg-green-950/40"
                                                                : "bg-red-50 text-red-500 dark:bg-red-950/30"
                                                        }`}>
                                                            {savings.saved ? `-${savings.percent}%` : `+${savings.percent}%`}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <span className="text-gray-450 dark:text-gray-500 block text-xs font-medium uppercase tracking-wider mb-0.5">{t(lang, "dimensions")}</span>
                                                <span className="font-semibold text-gray-750 dark:text-gray-300 text-base">
                                                    {resultDimensions ? `${resultDimensions.width} × ${resultDimensions.height}` : "..."}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="pt-2">
                                            <button
                                                onClick={handleDownload}
                                                className="w-full py-4 rounded-xl text-white font-semibold text-sm cursor-pointer shadow-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 transition-all hover:shadow-green-500/20 active:scale-[0.98] flex items-center justify-center gap-2"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                                </svg>
                                                <span>{t(lang, "downloadButton")}</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
