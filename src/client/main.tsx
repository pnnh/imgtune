import React from "react";
import ReactDOM from "react-dom/client";
import "./globals.css";
import App from "./App.js";
import { detectLocale } from "./i18n/detector.js";
import { loadMessages } from "./i18n/adapter.js";
import { detectRuntimeContext } from "./runtime/detect.js";

async function bootstrap() {
    const locale = detectLocale();
    await loadMessages(locale);
    const runtime = detectRuntimeContext();

    const root = document.getElementById("root");
    if (!root) throw new Error("Root element #root not found");

    ReactDOM.createRoot(root).render(
        <React.StrictMode>
            <App runtime={runtime} />
        </React.StrictMode>
    );
}

bootstrap();
