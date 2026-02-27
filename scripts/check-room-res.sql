SELECT rm.number, r.status, r.checkIn, r.checkOut 
FROM Reservation r 
JOIN Room rm ON r.roomId = rm.id 
WHERE rm.number LIKE '0%' 
  AND r.checkIn > '2026-02-20' 
ORDER BY r.checkIn DESC 
LIMIT 15;
