/**
 * Punkt wejścia dla Phusion Passenger (mydevil.net).
 * Uruchamia serwer Next.js z builda standalone.
 * Ładuje .env z public_nodejs, bo Passenger nie ustawia zmiennych z ~/.bash_profile.
 */
const path = require("path");

// Załaduj .env z katalogu aplikacji (public_nodejs) – Passenger nie dziedziczy ~/.bash_profile
try {
  require("dotenv").config({ path: path.join(__dirname, ".env") });
} catch (_) {}

const standaloneDir = path.join(__dirname, ".next", "standalone");
process.chdir(standaloneDir);
require(path.join(standaloneDir, "server.js"));
