import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {},
  serverExternalPackages: ['@langchain/core', '@langchain/langgraph', 'undici'],
};

export default nextConfig;
