import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { viteStaticCopy } from "vite-plugin-static-copy";
import path from "path";

// 构建目标：web | extension | webview
const target = (process.env.VITE_BUILD_TARGET ?? "web") as
  | "web"
  | "extension"
  | "webview";

const plugins = [react(), tailwindcss()];

if (target === "web") {
  plugins.push(
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico,woff2}"],
        runtimeCaching: [
          { urlPattern: /^\/api\//, handler: "NetworkOnly" },
          { urlPattern: /\/index\.html$/, handler: "NetworkFirst" },
        ],
      },
      manifest: {
        name: "ImgTune",
        short_name: "ImgTune",
        description: "Free online image converter",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#ffffff",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
    }) as ReturnType<typeof VitePWA>
  );
}

if (target === "extension") {
  plugins.push(
    viteStaticCopy({
      targets: [
        { src: "_locales", dest: "." },
        { src: "extension/manifest.json", dest: "." },
      ],
    })
  );
}

export default defineConfig({
  plugins,
  define: {
    // 构建时静态替换，Rollup tree-shaking 消除服务端代码路径
    "import.meta.env.OFFLINE": JSON.stringify(process.env.VITE_OFFLINE === "true"),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/client"),
    },
  },
  base: target === "web" ? "/" : "./",
  build: {
    outDir:
      target === "extension"
        ? "dist-ext"
        : target === "webview"
        ? "dist-webview"
        : "dist",
    rollupOptions:
      target === "extension"
        ? { output: { manualChunks: undefined } }
        : undefined,
  },
  server: {
    port: 5173,
    proxy: {
      // 开发时代理 API 请求到 Express
      "/api": "http://localhost:3000",
      "/_locales": "http://localhost:3000",
    },
  },
});
