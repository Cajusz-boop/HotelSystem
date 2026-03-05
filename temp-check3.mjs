import mysql from 'mysql2/promise';

const c = await mysql.createConnection('mysql://root:root123@10.119.169.20:3306/kwhotel');

// Szukam ETRAVEL, Tomasz Wybierała, ALSTOM - te widoczne w Bistro
const [rows] = await c.query(`
  SELECT r.RezerwacjaID, rm.name as Pokoj, k.Nazwisko, r.status_id, r.status2_id, DATE(r.DataOd) as Od, DATE(r.DataDo) as Do
  FROM rezerwacje r 
  LEFT JOIN rooms rm ON r.PokojID = rm.id 
  LEFT JOIN klienci k ON r.KlientID = k.KlientID 
  WHERE k.Nazwisko LIKE '%ETRAVEL%' 
     OR k.Nazwisko LIKE '%Wybierała%'
     OR k.Nazwisko LIKE '%ALSTOM%'
  ORDER BY r.RezerwacjaID DESC
  LIMIT 20
`);

console.log("=== Szukam ETRAVEL, Wybierała, ALSTOM ===");
console.log(JSON.stringify(rows, null, 2));

// Sprawdź też wszystkie aktywne (status_id=2) rezerwacje
const [active] = await c.query(`
  SELECT r.RezerwacjaID, rm.name as Pokoj, k.Nazwisko, r.status_id
  FROM rezerwacje r 
  LEFT JOIN rooms rm ON r.PokojID = rm.id 
  LEFT JOIN klienci k ON r.KlientID = k.KlientID 
  WHERE r.status_id = 2
  ORDER BY rm.name
`);

console.log("\n=== Wszystkie rezerwacje status_id=2 (aktywne) ===");
console.log(JSON.stringify(active, null, 2));

await c.end();
