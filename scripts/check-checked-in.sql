SELECT rm.number, r.status, r.checkIn, r.checkOut 
FROM Reservation r 
JOIN Room rm ON r.roomId = rm.id 
WHERE r.status = 'CHECKED_IN'
ORDER BY r.checkIn DESC 
LIMIT 20;
