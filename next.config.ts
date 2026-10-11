import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Learn serves chapter page images from contents/ through a route handler.
  outputFileTracingIncludes: {
    "/learn/**": ["./contents/pdfs/pages/**/*", "./contents/pdfs/*.pdf"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
