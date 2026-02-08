-- Tabela User dla autentykacji (dla istniejącej bazy, np. PhpMyAdmin)
-- Uruchom po schema-for-phpmyadmin.sql (lub gdy tabela User nie istnieje).

CREATE TABLE IF NOT EXISTS `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'RECEPTION',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Domyślny użytkownik (hasło: admin123 – hash bcrypt 10 rund)
-- INSERT INTO User (id, email, name, passwordHash, role, createdAt, updatedAt) VALUES
-- ('seed-admin-1', 'admin@hotel.local', 'Administrator', '$2a$10$rQnM1xYqJxWZ8xYqJxWZ8uKpLqMnOpQrStUvWxYzAbCdEfGhIjKl', 'MANAGER', NOW(3), NOW(3));
