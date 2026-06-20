import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {},
  serverExternalPackages: ['@langchain/core', '@langchain/langgraph', 'undici'],
};

export default nextConfig;
