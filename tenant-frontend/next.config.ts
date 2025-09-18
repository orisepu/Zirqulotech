import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // ESLint activo: no ignoramos errores en build

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
