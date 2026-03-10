SELECT r.id, r.rateCodeId, r.rateCodePrice, r.adults, r.children,
  rm.number, rm.type, rm.price AS room_price,
  rc.code, rc.name, rc.price AS rc_price, rc.basePrice, rc.pricePerPerson,
  (SELECT GROUP_CONCAT(CONCAT(rdr.date, ':', rdr.rate) SEPARATOR '; ') FROM ReservationDayRate rdr WHERE rdr.reservationId = r.id) AS day_rates
FROM Reservation r
LEFT JOIN Room rm ON rm.id = r.roomId
LEFT JOIN RateCode rc ON rc.id = r.rateCodeId
JOIN Guest g ON g.id = r.guestId
WHERE g.name LIKE '%Pufciak%'
ORDER BY r.checkOut DESC LIMIT 1;
