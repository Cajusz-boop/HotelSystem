-- AddProperty: post db-push – domyślny obiekt i przypisanie pokoi
-- Uruchom w PhpMyAdmin PO wykonaniu: npx prisma db push
-- (db push tworzy tabelę Property i kolumnę Room.propertyId)

INSERT IGNORE INTO `Property` (`id`, `name`, `code`, `createdAt`, `updatedAt`)
VALUES ('prop_default_main', 'Obiekt główny', 'default', NOW(3), NOW(3));

UPDATE `Room` SET `propertyId` = 'prop_default_main' WHERE `propertyId` IS NULL;
