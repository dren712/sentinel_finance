/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pg'],
  },
  webpack: (config, { isServer }) => {
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
