import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [new URL(process.env.NEXT_PUBLIC_BACKEND_MEDIA+"/**")],
    dangerouslyAllowLocalIP: true, // !!!
  },
};

export default nextConfig;
