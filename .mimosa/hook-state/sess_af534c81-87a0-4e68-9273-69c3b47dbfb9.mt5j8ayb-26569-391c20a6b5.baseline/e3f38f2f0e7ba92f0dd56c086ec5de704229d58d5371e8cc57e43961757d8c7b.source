import type { NextConfig } from "next";

/**
 * GitHub Pages serves project sites from `https://<user>.github.io/<repo>/`,
 * so every route and asset URL has to be prefixed. The deploy job builds with
 * `BASE_PATH=/SoftEng`; local builds, previews and the e2e run set nothing and
 * behave exactly as before (site rooted at `/`).
 *
 * Normalised so `/SoftEng`, `SoftEng` and `/SoftEng/` all work — Next requires
 * a leading slash and forbids a trailing one.
 */
const rawBasePath = process.env.BASE_PATH?.trim() ?? "";
const basePath = rawBasePath
  ? `/${rawBasePath.replace(/^\/+/, "").replace(/\/+$/, "")}`
  : "";

const nextConfig: NextConfig = {
  // Static export: the entire site is client-runnable HTML/JS/CSS.
  // Deploy target is any static host (Vercel serves `out/`).
  output: "export",
  // Empty strings are invalid values for these keys, so only set them when a
  // base path was actually requested.
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  images: {
    // next/image optimization needs a server; static export forbids it.
    unoptimized: true,
  },
};

export default nextConfig;
