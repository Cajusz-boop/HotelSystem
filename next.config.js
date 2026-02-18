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
  eslint: { ignoreDuringBuilds: true },
  env: {
    AUTH_DISABLED: process.env.AUTH_DISABLED || authDisabledFromSnapshot,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

module.exports = nextConfig;
