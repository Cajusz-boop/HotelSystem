SELECT r.id, r.confirmationNumber, g.name as guestName, rm.number as roomNumber, r.checkIn, r.checkOut, r.status 
FROM Reservation r 
JOIN Guest g ON r.guestId = g.id 
JOIN Room rm ON r.roomId = rm.id 
WHERE r.checkIn >= '2025-02-01' 
ORDER BY rm.number, r.checkIn 
LIMIT 50;
