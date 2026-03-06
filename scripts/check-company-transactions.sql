SELECT r.id, r.companyId, rm.number AS room_num
FROM Reservation r
JOIN Room rm ON rm.id = r.roomId
JOIN Guest g ON g.id = r.guestId
WHERE g.name LIKE '%AMBROZIAK%' AND rm.number IN ('002','003','004');

SELECT t.reservationId, t.type, t.amount
FROM Transaction t
JOIN Reservation r ON r.id = t.reservationId
JOIN Guest g ON g.id = r.guestId
JOIN Room rm ON rm.id = r.roomId
WHERE g.name LIKE '%AMBROZIAK%' AND rm.number IN ('002','003','004');
