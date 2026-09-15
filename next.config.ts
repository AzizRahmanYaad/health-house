import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      /* avatar / subtitle / plain (non-chunked) uploads go through server actions */
      bodySizeLimit: '25mb',
    },
  },
};

export default nextConfig;
