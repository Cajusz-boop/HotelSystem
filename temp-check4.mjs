import mysql from 'mysql2/promise';

const c = await mysql.createConnection('mysql://root:root123@10.119.169.20:3306/kwhotel');

// Lista wszystkich tabel w bazie
const [tables] = await c.query("SHOW TABLES");
console.log("=== Tabele w bazie kwhotel ===");
for (const t of tables) {
  console.log(Object.values(t)[0]);
}

// Sprawdź czy jest osobna tabela dla hotelowych gości/pokoi dla Bistro
const [pokojeHotel] = await c.query("SHOW TABLES LIKE '%hotel%'");
console.log("\n=== Tabele z 'hotel' ===");
console.log(pokojeHotel);

const [posilek] = await c.query("SHOW TABLES LIKE '%posil%'");
console.log("\n=== Tabele z 'posil' ===");
console.log(posilek);

const [gastro] = await c.query("SHOW TABLES LIKE '%gastro%'");
console.log("\n=== Tabele z 'gastro' ===");
console.log(gastro);

await c.end();
