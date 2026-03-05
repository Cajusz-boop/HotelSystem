import mysql from 'mysql2/promise';

const c = await mysql.createConnection('mysql://root:root123@10.119.169.20:3306/kwhotel');

// Porównaj rezerwacje widoczne w Bistro vs nasze
const [rows] = await c.query(`
  SELECT r.RezerwacjaID, rm.name as Pokoj, k.Nazwisko, r.status_id, r.status2_id, DATE(r.DataOd) as Od, DATE(r.DataDo) as Do
  FROM rezerwacje r 
  LEFT JOIN rooms rm ON r.PokojID = rm.id 
  LEFT JOIN klienci k ON r.KlientID = k.KlientID 
  WHERE (rm.name IN ('009', '011', '012', '013', '014', '015', 'SI 020', 'SI 021', 'SI 025', 'SI 026')
         OR rm.name LIKE '009%' OR rm.name LIKE '011%' OR rm.name LIKE '012%')
    AND r.DataDo >= '2026-02-28'
  ORDER BY rm.name, r.status_id
`);

console.log("=== Rezerwacje dla pokoi ===");
for (const r of rows) {
  console.log(`${r.Pokoj.trim().padEnd(8)} | status_id=${r.status_id} | ${r.Nazwisko?.substring(0,25).padEnd(25)} | ${r.Od} - ${r.Do}`);
}

await c.end();
