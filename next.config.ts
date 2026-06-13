import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Build standalone para Docker/VPS (genera .next/standalone con node server.js)
  output: 'standalone',
  // Activa el MCP server en /_next/mcp (Next.js 16+)
  experimental: {
    mcpServer: true,
  },
  // Permite acceder al dev server desde otras máquinas de la red local
  // (sin esto, Next 16 bloquea los recursos /_next/* desde un origen != localhost
  //  y el JS no hidrata → botones que "no hacen nada").
  allowedDevOrigins: ['192.168.1.20'],
}

export default nextConfig
