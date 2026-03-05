SELECT rm.number, r.status, r.checkIn, r.checkOut, g.name as guest, r.createdAt
FROM Reservation r 
JOIN Room rm ON r.roomId = rm.id 
JOIN Guest g ON r.guestId = g.id
WHERE g.name LIKE '%ojenkowski%' OR g.name LIKE '%OJENKOWSKI%'
ORDER BY r.createdAt DESC
LIMIT 10;
