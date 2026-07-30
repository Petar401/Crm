import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  // The App Router does not register routes inside a dot-prefixed `.well-known`
  // directory, so the OAuth metadata handlers live under `well-known/` and are
  // reached at their canonical dotted paths via this rewrite.
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/.well-known/:path*",
          destination: "/well-known/:path*",
        },
      ],
    };
  },
};

export default nextConfig;
