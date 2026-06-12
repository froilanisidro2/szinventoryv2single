/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  swcMinify: true,
  compress: true,
  productionBrowserSourceMaps: false,
  
  /* Headers for caching optimization */
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
      {
        source: '/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Content-Type', value: 'application/manifest+json' },
        ],
      },
    ];
  },

  /* Redirects for API compat */
  async redirects() {
    return [
      {
        source: '/api/v1/:path*',
        destination: '/api/:path*',
        permanent: false,
      },
    ];
  },

  /* Environment variables */
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
    NEXT_PUBLIC_APP_NAME: 'SprintZeroPH Inventory Management System',
  },

  /* Webpack config */
  webpack: (config, { isServer }) => {
    config.optimization.splitChunks.cacheGroups = {
      default: false,
      vendors: false,
      core: {
        name: 'core',
        chunks: 'all',
        minChunks: 2,
        priority: 10,
        reuseExistingChunk: true,
      },
    };
    return config;
  },
};

module.exports = nextConfig;
