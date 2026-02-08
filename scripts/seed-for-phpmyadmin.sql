-- Dane startowe do bazy w chmurze (PhpMyAdmin)
-- Uruchom w PhpMyAdmin (zakładka SQL). Po wykonaniu Tape Chart w chmurze pokaże pokoje i rezerwacje.

USE m14753_hotel_system_rezerwacji;
SET NAMES utf8mb4;

-- Pokoje (jak w prisma/seed.ts)
INSERT INTO `Room` (`id`, `number`, `type`, `status`, `price`, `reason`, `createdAt`, `updatedAt`) VALUES
('room-101', '101', 'Queen', 'CLEAN', 300.00, NULL, NOW(3), NOW(3)),
('room-102', '102', 'Twin', 'DIRTY', 280.00, NULL, NOW(3), NOW(3)),
('room-103', '103', 'Suite', 'OOO', 550.00, 'Broken AC', NOW(3), NOW(3)),
('room-104', '104', 'Twin', 'CLEAN', 280.00, NULL, NOW(3), NOW(3)),
('room-105', '105', 'Queen', 'OOO', 300.00, NULL, NOW(3), NOW(3)),
('room-106', '106', 'Twin', 'CLEAN', 280.00, NULL, NOW(3), NOW(3)),
('room-201', '201', 'Suite', 'OOO', 550.00, 'Renovation', NOW(3), NOW(3)),
('room-202', '202', 'Queen', 'CLEAN', 300.00, NULL, NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE `number` = VALUES(`number`);

-- Goście
INSERT INTO `Guest` (`id`, `name`, `email`, `phone`, `mrz`, `createdAt`, `updatedAt`) VALUES
('guest-1', 'Smith, J.', NULL, NULL, NULL, NOW(3), NOW(3)),
('guest-2', 'Doe, A.', NULL, NULL, NULL, NOW(3), NOW(3)),
('guest-3', 'Kowalski, P.', NULL, NULL, NULL, NOW(3), NOW(3)),
('guest-4', 'Jan Kowalski', NULL, NULL, NULL, NOW(3), NOW(3)),
('guest-5', 'Anna Nowak', NULL, NULL, NULL, NOW(3), NOW(3)),
('guest-6', 'Thomas Smith', NULL, NULL, NULL, NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- Rezerwacje (odnoszą się do powyższych id)
INSERT INTO `Reservation` (`id`, `guestId`, `roomId`, `checkIn`, `checkOut`, `status`, `pax`, `createdAt`, `updatedAt`) VALUES
('res-1', 'guest-1', 'room-101', '2026-02-07', '2026-02-09', 'CHECKED_IN', 2, NOW(3), NOW(3)),
('res-2', 'guest-2', 'room-102', '2026-02-09', '2026-02-11', 'CONFIRMED', 1, NOW(3), NOW(3)),
('res-3', 'guest-3', 'room-104', '2026-02-11', '2026-02-14', 'CONFIRMED', 1, NOW(3), NOW(3)),
('res-4', 'guest-4', 'room-101', '2026-02-10', '2026-02-13', 'CONFIRMED', 2, NOW(3), NOW(3)),
('res-5', 'guest-5', 'room-202', '2026-02-08', '2026-02-12', 'CONFIRMED', 2, NOW(3), NOW(3)),
('res-6', 'guest-6', 'room-201', '2026-02-07', '2026-02-10', 'CHECKED_IN', 1, NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE `guestId` = VALUES(`guestId`);
