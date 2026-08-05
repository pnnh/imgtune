import React from "react";
import { BrowserRouter, HashRouter, Route, Routes } from "react-router-dom";
import { RuntimeProvider } from "./runtime/context.js";
import type { RuntimeContext } from "./runtime/detect.js";
import Home from "./pages/Home.js";

interface AppProps {
    runtime: RuntimeContext;
}

export default function App({ runtime }: AppProps) {
    // Chrome 扩展使用 HashRouter（chrome-extension:// 协议不支持 History API）
    const Router = runtime.type === "extension" ? HashRouter : BrowserRouter;

    return (
        <RuntimeProvider runtime={runtime}>
            <Router>
                <Routes>
                    <Route path="/" element={<Home />} />
                </Routes>
            </Router>
        </RuntimeProvider>
    );
}
