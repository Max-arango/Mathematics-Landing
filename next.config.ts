import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* Native/NAPI modules must stay external (not bundled by Turbopack). */
  serverExternalPackages: ["@node-rs/argon2", "@prisma/client", "prisma"],
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
