import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pino", "@prisma/client", "@prisma/adapter-pg", "pg"],
};

export default nextConfig;
