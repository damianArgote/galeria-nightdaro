import type { NextConfig } from "next";
import { galleryRewrites } from "./src/app/g/routing";

const nextConfig: NextConfig = {
  async rewrites() {
    // Before files, so the public gallery paths always resolve to /g/{sfw|adult}/….
    return { beforeFiles: galleryRewrites(), afterFiles: [], fallback: [] };
  },
};

export default nextConfig;
