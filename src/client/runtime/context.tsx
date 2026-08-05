import React, { createContext, useContext } from "react";
import type { RuntimeContext, RuntimeType } from "./detect.js";

export interface PlatformCapabilities {
    canConvertImages: boolean;
    hasBackend: boolean;
    canInstallPwa: boolean;
    router: "browser" | "hash";
}

function computeCapabilities(runtime: RuntimeContext): PlatformCapabilities {
    const { type, hasBackend } = runtime;
    switch (type) {
        case "web":
            return { canConvertImages: true, hasBackend, canInstallPwa: true, router: "browser" };
        case "pwa":
            return { canConvertImages: true, hasBackend, canInstallPwa: false, router: "browser" };
        case "extension":
            return { canConvertImages: true, hasBackend, canInstallPwa: false, router: "hash" };
        case "webview":
            return { canConvertImages: true, hasBackend, canInstallPwa: false, router: "browser" };
    }
}

interface RuntimeContextValue {
    runtime: RuntimeContext;
    capabilities: PlatformCapabilities;
}

const Ctx = createContext<RuntimeContextValue | null>(null);

interface RuntimeProviderProps {
    runtime: RuntimeContext;
    children: React.ReactNode;
}

export function RuntimeProvider({ runtime, children }: RuntimeProviderProps) {
    const capabilities = computeCapabilities(runtime);
    return <Ctx.Provider value={{ runtime, capabilities }}>{children}</Ctx.Provider>;
}

export function useRuntime(): RuntimeContextValue {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error("useRuntime must be used inside RuntimeProvider");
    return ctx;
}
