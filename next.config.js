/** @type {import('next').NextConfig} */

// Czytaj authDisabled z config-snapshot.json (jeśli istnieje) i ustaw jako env
const fs = require("fs");
const path = require("path");
let authDisabledFromSnapshot = "false";
try {
  const snapshotPath = path.join(__dirname, "prisma", "config-snapshot.json");
  if (fs.existsSync(snapshotPath)) {
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
    if (snapshot?.hotelConfig?.authDisabled === true) {
      authDisabledFromSnapshot = "true";
    }
  }
} catch {}

const nextConfig = {
  output: "standalone",
  eslint: { ignoreDuringBuilds: false },
  env: {
    AUTH_DISABLED: process.env.AUTH_DISABLED || authDisabledFromSnapshot,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    optimizePackageImports: ["lucide-react", "@radix-ui/react-icons", "recharts"],
    outputFileTracingIncludes: {
      "/api/fiscal/bridge-installer": ["./posnet-bridge-installer/**/*"],
    },
    outputFileTracingExcludes: {
      "*": [
        "**/.git/**",
        ".git/**",
        "**/*.tar",
        "**/*.tar.gz", 
        "**/*.zip",
        "**/_deploy_*/**",
        "**/_test_*/**",
        "**/test-results/**",
        "**/playwright-report/**",
        "**/tests/**",
        "**/__tests__/**",
        "**/Test/**",
      ],
    },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks?.cacheGroups,
          vendors: {
            test: /[\\/]node_modules[\\/]/,
            name: "vendors",
            chunks: "all",
            priority: 10,
          },
          recharts: {
            test: /[\\/]node_modules[\\/](recharts|d3-.*)[\\/]/,
            name: "recharts",
            chunks: "all",
            priority: 20,
          },
        },
      };
    }
    return config;
  },
};

// Bundle analyzer - uruchom: ANALYZE=true npm run build
const withBundleAnalyzer =
  process.env.ANALYZE === "true"
    ? require("@next/bundle-analyzer")({ enabled: true })
    : (config) => config;

module.exports = withBundleAnalyzer(nextConfig);
