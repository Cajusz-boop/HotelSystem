SELECT roomNumber, amount, createdAt, status
FROM UnassignedGastronomyCharge
ORDER BY createdAt DESC
LIMIT 15;
