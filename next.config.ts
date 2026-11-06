import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  distDir: process.env.NEXT_TEST_BUILD_DIR ?? ".next",
  serverExternalPackages: ["pdfjs-dist"],
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Referrer-Policy", value: "strict-origin" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
      ],
    }];
  },
};

export default config;
