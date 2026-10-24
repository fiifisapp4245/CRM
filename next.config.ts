import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the floating "N" development badge so it isn't mistaken for part of the CRM
  // during demos. Build and runtime errors are still shown.
  devIndicators: false,
};

export default nextConfig;
