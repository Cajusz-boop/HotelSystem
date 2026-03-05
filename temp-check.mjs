import mysql from 'mysql2/promise';

const c = await mysql.createConnection('mysql://root:root123@10.119.169.20:3306/kwhotel');

// Sprawdź rezerwacje dla pokoi widocznych w Bistro
const [rows] = await c.query(`
  SELECT r.RezerwacjaID, rm.name as Pokoj, k.Nazwisko, r.status_id, r.status2_id, DATE(r.DataOd) as Od, DATE(r.DataDo) as Do
  FROM rezerwacje r 
  LEFT JOIN rooms rm ON r.PokojID = rm.id 
  LEFT JOIN klienci k ON r.KlientID = k.KlientID 
  WHERE rm.name IN ('008', '011', '015', '016', 'SI 020', 'SI 021', '012')
    AND r.DataDo >= '2026-02-27'
  ORDER BY rm.name, r.RezerwacjaID DESC
`);

console.log(JSON.stringify(rows, null, 2));
await c.end();
