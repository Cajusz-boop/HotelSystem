import mysql from 'mysql2/promise';

const c = await mysql.createConnection('mysql://root:root123@10.119.169.20:3306/kwhotel');

// Szukam rezerwacji widocznych w Bistro - te z dzisiejszą datą
const [rows] = await c.query(`
  SELECT r.RezerwacjaID, rm.name as Pokoj, k.Nazwisko, r.status_id, r.status2_id, DATE(r.DataOd) as Od, DATE(r.DataDo) as Do
  FROM rezerwacje r 
  LEFT JOIN rooms rm ON r.PokojID = rm.id 
  LEFT JOIN klienci k ON r.KlientID = k.KlientID 
  WHERE (k.Nazwisko LIKE '%Wojenkowski%'
     OR k.Nazwisko LIKE '%Czanecki%'
     OR k.Nazwisko LIKE '%Miadziel%'
     OR k.Nazwisko LIKE '%Włodarczyk%'
     OR k.Nazwisko LIKE '%Czarnecki%'
     OR k.Nazwisko LIKE '%KOZELSKA%'
     OR k.Nazwisko LIKE '%Stępkowska%'
     OR k.Nazwisko LIKE '%Farat%'
     OR k.Nazwisko LIKE '%idea art%')
    AND r.DataDo >= '2026-02-27'
  ORDER BY r.RezerwacjaID DESC
`);

console.log("=== Rezerwacje widoczne/niewidoczne w Bistro ===");
for (const r of rows) {
  const visible = r.status_id === 1 ? "WIDOCZNE" : (r.status_id === 2 ? "NASZE(s=2)" : `s=${r.status_id}`);
  console.log(`${r.Pokoj?.trim().padEnd(8)} | ${visible.padEnd(12)} | ${r.Nazwisko?.substring(0,25).padEnd(25)} | ${r.Od} - ${r.Do}`);
}

await c.end();
