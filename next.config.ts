import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  // The App Router does not register routes inside a dot-prefixed `.well-known`
  // directory, so the RFC 9728 metadata handler lives under `well-known/` and
  // is reached at its canonical dotted path via this rewrite.
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/.well-known/oauth-protected-resource/:path*",
          destination: "/well-known/oauth-protected-resource/:path*",
        },
      ],
    };
  },
};

export default nextConfig;
