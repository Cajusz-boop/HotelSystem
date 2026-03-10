SELECT t.type, t.amount, t.description
FROM Transaction t
JOIN Reservation r ON r.id = t.reservationId
JOIN Guest g ON g.id = r.guestId
WHERE g.name LIKE '%Pufciak%'
  AND (t.status = 'ACTIVE' OR t.status IS NULL)
ORDER BY r.checkOut DESC, t.createdAt LIMIT 20;
