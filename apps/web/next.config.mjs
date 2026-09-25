import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@sentinel/domain', '@sentinel/sdk'],
  serverExternalPackages: ['pg'],

  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@sentinel/domain': path.resolve(__dirname, '../../packages/domain/src/index.ts'),
      '@sentinel/sdk': path.resolve(__dirname, '../../packages/sdk/src/index.ts'),
    };
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        pg: false,
        'pg-native': false,
        fs: false,
        net: false,
        tls: false,
        dns: false,
      };
    }
    return config;
  },
};

export default nextConfig;
