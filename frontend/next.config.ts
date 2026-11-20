import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compiler: {
    // Strip console.log / console.debug (and info, trace) from production bundles.
    // console.error and console.warn stay for error telemetry. Development is untouched.
    removeConsole:
      process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
};

export default nextConfig;
