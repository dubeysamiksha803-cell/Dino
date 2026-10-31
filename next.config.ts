import type { NextConfig } from "next";
import createNextPwa from "next-pwa";

const withPWA = createNextPwa({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  /* other config options can go here */
  // Explicitly declare Turbopack config so Next 16 is satisfied even though
  // next-pwa adds webpack-specific configuration under the hood.
  turbopack: {},
};

export default withPWA(nextConfig);
