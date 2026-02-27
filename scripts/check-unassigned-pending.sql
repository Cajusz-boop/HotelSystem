SELECT id, roomNumber, amount, createdAt 
FROM UnassignedGastronomyCharge 
WHERE status = 'PENDING' 
ORDER BY createdAt;
