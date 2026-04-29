/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  allowedDevOrigins: [
    "http://10.144.38.100:3000",
    "http://10.144.38.100",
    "http://10.144.38.113:3000",
    "http://10.144.38.113",
  ],
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client"],
  },
};

module.exports = nextConfig;
