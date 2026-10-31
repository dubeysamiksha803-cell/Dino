declare module "next-pwa" {
  import type { NextConfig } from "next";

  interface NextPwaOptions {
    dest: string;
    register?: boolean;
    skipWaiting?: boolean;
    disable?: boolean;
  }

  export default function createNextPwa(options: NextPwaOptions): (config: NextConfig) => NextConfig;
}
