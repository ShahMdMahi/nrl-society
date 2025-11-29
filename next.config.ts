import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  // Optimize for Cloudflare Workers bundle size
  experimental: {
    // Reduce bundle size by not including unnecessary polyfills
    optimizePackageImports: [
      "lucide-react",
      "react-hook-form",
      "zod",
      "@hookform/resolvers",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-avatar",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-label",
      "@radix-ui/react-popover",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-separator",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
      "@radix-ui/react-tooltip",
    ],
  },
  // Disable image optimization (not supported on Cloudflare Workers)
  images: {
    unoptimized: true,
  },
  // Exclude source maps in production to reduce size
  productionBrowserSourceMaps: false,
};

export default withBundleAnalyzer(nextConfig);
