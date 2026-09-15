import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  /* the SQL files must ship with the serverless function that runs /api/setup */
  outputFileTracingIncludes: {
    '/api/setup': ['./database/*.sql'],
  },
  experimental: {
    serverActions: {
      /* avatar / subtitle / plain (non-chunked) uploads go through server actions */
      bodySizeLimit: '25mb',
    },
  },
};

export default nextConfig;
