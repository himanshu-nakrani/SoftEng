import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: the entire site is client-runnable HTML/JS/CSS.
  // Deploy target is any static host (Vercel serves `out/`).
  output: "export",
  images: {
    // next/image optimization needs a server; static export forbids it.
    unoptimized: true,
  },
};

export default nextConfig;
