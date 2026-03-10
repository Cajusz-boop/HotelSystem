SELECT rt.name, rt.basePrice, rt.rateCodeId,
  rp.price AS rp_price, rp.pricePerPerson, rp.adultPrice, rp.validFrom, rp.validTo,
  dro.price AS override_price
FROM RoomType rt
LEFT JOIN RatePlan rp ON rp.roomTypeId = rt.id
  AND '2026-03-09' BETWEEN rp.validFrom AND rp.validTo
LEFT JOIN DailyRateOverride dro ON dro.roomTypeId = rt.id
  AND dro.date = '2026-03-09'
WHERE rt.name = 'COMFORT - z widokiem na jezioro';


