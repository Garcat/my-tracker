import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Qoder Sites serves static files only. Server behavior lives in functions/index.ts.
  output: "export",
  images: { unoptimized: true },
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
