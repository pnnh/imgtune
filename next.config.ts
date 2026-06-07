import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a self-contained Node.js server under .next/standalone.
  // This is the recommended output mode for containerised deployments.
  output: "standalone",
};

export default nextConfig;
