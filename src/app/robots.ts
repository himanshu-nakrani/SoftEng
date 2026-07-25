import { absoluteUrl } from "@/lib/site";
import type { MetadataRoute } from "next";

/** Static export: emitted to out/robots.txt at build time. */
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
