SELECT ra.id, ra.roomId, ra.startDate, ra.endDate, ra.reservationId 
FROM RoomAssignment ra 
LEFT JOIN Reservation r ON ra.reservationId = r.id 
WHERE r.id IS NULL;
