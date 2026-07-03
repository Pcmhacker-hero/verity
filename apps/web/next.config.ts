import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Doc 17 §5.1: standalone output for Docker deployment
  output: 'standalone',

  // Transpile internal workspace packages
  transpilePackages: [
    '@verity/shared',
    '@verity/database',
    '@verity/services',
    '@verity/queue',
  ],

  // Doc 16 §7.3: Security headers
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains',
        },
        {
          key: 'Content-Security-Policy',
          value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.anthropic.com",
        },
      ],
    },
  ],
};

export default nextConfig;
