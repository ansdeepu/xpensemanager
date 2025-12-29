import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.cloudworkstations.dev"],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
