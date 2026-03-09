-- ============================================================
-- Migration: Admin Auth Setup
-- Date: 2026-03-07 12:00:00
-- Description:
--   1. Makes password_hash nullable (app is fully passwordless — email OTP only)
--   2. Adds 'author' to users.role enum (keeps existing values)
--   3. Adds users.author_id FK → authors.id (links user account to author profile)
--   4. Creates admin_login_codes table for email OTP auth flow
-- ============================================================

-- 1. Make password_hash nullable — app is fully passwordless (email OTP)
ALTER TABLE `users`
  MODIFY COLUMN `password_hash` VARCHAR(255)
    COLLATE utf8mb4_unicode_ci DEFAULT NULL;

-- 2. Add 'author' role to users table
ALTER TABLE `users`
  MODIFY COLUMN `role` ENUM('admin','editor','reader','author')
    COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'reader';

-- 3. Link users → authors (optional: an admin/author user may own an author profile)
ALTER TABLE `users`
  ADD COLUMN `author_id` INT(10) UNSIGNED DEFAULT NULL,
  ADD CONSTRAINT `fk_users_author`
    FOREIGN KEY (`author_id`) REFERENCES `authors` (`id`)
    ON DELETE SET NULL;

-- 4. OTP codes table for passwordless email login
CREATE TABLE `admin_login_codes` (
  `id`         INT(10) UNSIGNED    NOT NULL AUTO_INCREMENT,
  `email`      VARCHAR(255)        COLLATE utf8mb4_unicode_ci NOT NULL,
  `code`       VARCHAR(10)         COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` TIMESTAMP           NOT NULL,
  `used`       TINYINT(1)          NOT NULL DEFAULT 0,
  `ip_hash`    VARCHAR(64)         COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'SHA-256 of requester IP for rate-limit auditing',
  `created_at` TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_email_expires` (`email`, `expires_at`),
  KEY `idx_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Short-lived OTP codes for admin/author email login';

INSERT INTO users (email, name, role, email_verified)
VALUES ('axgoomez@gmail.com', 'Alex Gomez', 'admin', 1);

-- ============================================================
-- To create additional admin users, run:
-- INSERT INTO users (email, name, role, email_verified)
--   VALUES ('admin@example.com', 'Admin', 'admin', 1);
-- ============================================================
