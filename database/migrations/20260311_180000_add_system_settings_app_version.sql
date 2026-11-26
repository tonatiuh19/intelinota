-- Migration: system_settings table + initial app_version
-- Date: 2026-03-11 18:00:00

CREATE TABLE IF NOT EXISTS `system_settings` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `setting_key` VARCHAR(100) NOT NULL,
  `setting_value` TEXT NULL,
  `setting_type` ENUM('string','number','boolean','json') NOT NULL DEFAULT 'string',
  `description` TEXT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_system_settings_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `system_settings` (`setting_key`, `setting_value`, `setting_type`, `description`)
VALUES (
  'app_version',
  'v1.0.0',
  'string',
  'Current deployed application version shown in the site footer.'
)
ON DUPLICATE KEY UPDATE
  `description` = VALUES(`description`);
