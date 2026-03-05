SELECT r.id, g.name, rm.number, r.checkIn, r.checkOut, r.status 
FROM Reservation r 
JOIN Guest g ON r.guestId = g.id 
JOIN Room rm ON r.roomId = rm.id 
WHERE r.checkIn >= '2025-03-01' AND r.checkIn < '2025-04-01'
AND r.status NOT IN ('CANCELLED', 'NO_SHOW')
ORDER BY rm.number, r.checkIn;
