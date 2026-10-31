import withPWA from 'next-pwa';

const withPWANext = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {},
};

export default withPWANext(nextConfig);
