/** @type {import('next').NextConfig} */
const nextConfig = {
  // PWA configuration using Next.js built-in features
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ]
  },
  // Service worker and PWA assets
  async rewrites() {
    return [
      {
        source: '/sw.js',
        destination: '/api/sw',
      },
    ]
  },
  experimental: {
    webVitalsAttribution: ['CLS','LCP','FID','FCP','TTFB'],
  },
}

module.exports = nextConfig
