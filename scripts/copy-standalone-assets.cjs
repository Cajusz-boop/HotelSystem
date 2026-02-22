/**
 * Kopiuje pliki statyczne Next.js i klienta Prisma do .next/standalone,
 * żeby uruchomienie `node app.js` (lub deploy) miało dostęp do CSS/JS i bazy.
 * Uruchamiane jako postbuild (npm run build).
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const standaloneDir = path.join(root, ".next", "standalone");
const standaloneNext = path.join(standaloneDir, ".next");

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dest, name);
    if (fs.statSync(s).isDirectory()) {
      copyRecursive(s, d);
    } else {
      fs.mkdirSync(path.dirname(d), { recursive: true });
      fs.copyFileSync(s, d);
    }
  }
}

// .next/static -> .next/standalone/.next/static
const staticSrc = path.join(root, ".next", "static");
const staticDest = path.join(standaloneNext, "static");
if (fs.existsSync(staticSrc)) {
  fs.mkdirSync(standaloneNext, { recursive: true });
  copyRecursive(staticSrc, staticDest);
  console.log("copy-standalone-assets: .next/static -> standalone/.next/static");
} else {
  console.warn("copy-standalone-assets: brak .next/static (pomijam)");
}

// node_modules/.prisma -> .next/standalone/node_modules/.prisma
const prismaSrc = path.join(root, "node_modules", ".prisma");
const prismaDest = path.join(standaloneDir, "node_modules", ".prisma");
if (fs.existsSync(prismaSrc)) {
  copyRecursive(prismaSrc, prismaDest);
  console.log("copy-standalone-assets: node_modules/.prisma -> standalone");
} else {
  console.warn("copy-standalone-assets: brak node_modules/.prisma (pomijam)");
}

// public -> .next/standalone/public (dla PWA: manifest.json, sw.js, icons)
const publicSrc = path.join(root, "public");
const publicDest = path.join(standaloneDir, "public");
if (fs.existsSync(publicSrc)) {
  copyRecursive(publicSrc, publicDest);
  console.log("copy-standalone-assets: public -> standalone/public (PWA assets)");
} else {
  console.warn("copy-standalone-assets: brak public (pomijam)");
}
