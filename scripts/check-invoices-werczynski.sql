SELECT inv.number, inv.amountGross, inv.reservationId, inv.issuedAt
FROM Invoice inv
JOIN Reservation r ON r.id = inv.reservationId
JOIN Guest g ON g.id = r.guestId
WHERE g.name LIKE '%WERCZY%'
ORDER BY inv.issuedAt;
