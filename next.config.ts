import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  // Node-only email libraries (SMTP send + IMAP read). Kept out of the bundler
  // so their native/dynamic requires resolve at runtime on the Node server and
  // never leak into a client chunk. Only imported from `"use server"` actions
  // and route handlers.
  serverExternalPackages: ["nodemailer", "imapflow", "mailparser"],
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

// Bundle analyzer: run `ANALYZE=true pnpm build` to produce the treemap HTML
// under `.next/analyze/` and see which client chunks are shipping which deps.
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

export default withBundleAnalyzer(nextConfig);
