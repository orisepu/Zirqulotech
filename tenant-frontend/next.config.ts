import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // CKEditor 5 aggregated necesita transpilarse
  transpilePackages: ["ckeditor5"],

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "https://progeek.es/api/:path*",
      },
    ];
  },
};

export default nextConfig;