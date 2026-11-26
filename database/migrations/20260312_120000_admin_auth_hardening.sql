-- Migration: OTP hash storage + verify rate-limit attempts
-- Date: 2026-03-12 12:00:00

ALTER TABLE `admin_login_codes`
  MODIFY COLUMN `code` VARCHAR(64) NOT NULL;

CREATE TABLE IF NOT EXISTS `admin_login_attempts` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL,
  `ip_hash` VARCHAR(64) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_attempts_email_created` (`email`, `created_at`),
  KEY `idx_attempts_ip_created` (`ip_hash`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
