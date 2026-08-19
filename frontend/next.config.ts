import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // petposture.test (Laragon local dev domain) needs to be explicitly
  // allowlisted, or Next.js blocks cross-origin requests to dev resources
  // (including the webpack-hmr WebSocket) from it — this was silently
  // hanging any page combining useSearchParams() + Suspense + dynamic
  // rendering (e.g. /checkout/success), since that combo needs a dev-mode
  // handshake over the same blocked channel.
  allowedDevOrigins: ['petposture.test'],
  turbopack: {
    root: path.join(__dirname, '..'),
  },
  async redirects() {
    return [
      {
        source: '/auth',
        destination: '/sign-in',
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'api.petposture.com',
      },
      {
        protocol: 'http',
        hostname: 'petposture.test',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '8000',
      },
    ],
  },
};

export default nextConfig;
