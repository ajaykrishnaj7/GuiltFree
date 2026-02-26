import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";
const devPort = process.env.PORT || '3000';

const getDynamicDevOrigins = () => {
  const origins = new Set<string>([
    'http://localhost',
    `http://localhost:${devPort}`,
    'http://127.0.0.1',
    `http://127.0.0.1:${devPort}`,
  ]);

  const nets = networkInterfaces();
  for (const iface of Object.values(nets)) {
    if (!iface) continue;
    for (const net of iface) {
      if (net.family !== 'IPv4' || net.internal || !net.address) continue;
      origins.add(`http://${net.address}`);
      origins.add(`http://${net.address}:${devPort}`);
      origins.add(`https://${net.address}`);
      origins.add(`https://${net.address}:${devPort}`);
    }
  }

  return Array.from(origins);
};

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: getDynamicDevOrigins(),
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
