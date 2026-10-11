/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Leaflet ships CSS that references some assets that Next will not bundle
  // by default; transpile the module so SSR builds succeed.
  transpilePackages: ['react-leaflet', '@react-leaflet/core'],
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'unpkg.com' },
      { protocol: 'https', hostname: 'tile.openstreetmap.org' }
    ]
  }
};

module.exports = nextConfig;