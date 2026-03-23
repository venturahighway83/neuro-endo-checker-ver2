import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow Next.js to transpile TypeScript source from workspace packages
  transpilePackages: [
    '@neuro-endo/core',
    '@neuro-endo/ui',
    '@neuro-endo/device-master',
  ],
};

export default nextConfig;
