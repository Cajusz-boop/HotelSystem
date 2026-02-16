/**
 * Punkt wejścia dla Phusion Passenger (mydevil.net).
 * Uruchamia serwer Next.js z builda standalone.
 * Ładuje .env z public_nodejs, bo Passenger nie ustawia zmiennych z ~/.bash_profile.
 *
 * Po starcie serwera wykonuje warm-up ping /api/health, żeby:
 *  - zainicjalizować singleton Prisma i połączenie z bazą
 *  - skrócić czas pierwszego żądania użytkownika
 */
const path = require("path");
const http = require("http");

// Załaduj .env z katalogu aplikacji (public_nodejs) – Passenger nie dziedziczy ~/.bash_profile
try {
  require("dotenv").config({ path: path.join(__dirname, ".env") });
} catch (_) {}

const standaloneDir = path.join(__dirname, ".next", "standalone");
process.chdir(standaloneDir);
require(path.join(standaloneDir, "server.js"));

/**
 * Warm-up: po starcie aplikacji odpytaj /api/health żeby rozgrzać
 * Prisma client i połączenie z bazą zanim przyjdzie pierwsze żądanie.
 */
function warmUp() {
  const port = process.env.PORT || 3000;
  const url = `http://127.0.0.1:${port}/api/health`;
  http
    .get(url, (res) => {
      res.resume();
    })
    .on("error", () => {
      // Serwer jeszcze nie słucha – spróbuj za 2s
      setTimeout(warmUp, 2000);
    });
}

setTimeout(warmUp, 3000);
