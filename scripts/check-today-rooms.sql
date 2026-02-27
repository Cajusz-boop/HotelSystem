SELECT rm.number, r.status, r.checkIn, r.checkOut 
FROM Reservation r 
JOIN Room rm ON r.roomId = rm.id 
WHERE rm.number IN ('005', '006', '007', '009', '011', '012', '013', '015', '016')
  AND r.checkIn <= '2026-02-27'
  AND r.checkOut >= '2026-02-27'
ORDER BY rm.number;
