SELECT rm.number, r.status, r.checkIn, r.checkOut, g.name as guest
FROM Reservation r 
JOIN Room rm ON r.roomId = rm.id 
JOIN Guest g ON r.guestId = g.id
WHERE rm.number = '005'
  AND r.checkIn >= '2026-02-25'
ORDER BY r.checkIn DESC
LIMIT 10;
