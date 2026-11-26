-- Migration: newsroom timezone (used to display/schedule publish times)
-- Date: 2026-11-26 12:06:00
INSERT IGNORE INTO `system_settings` (`setting_key`, `setting_value`, `setting_type`, `description`)
VALUES (
  'newsroom_timezone',
  'America/Mexico_City',
  'string',
  'IANA timezone of the newsroom; scheduling times are entered and shown in this zone.'
);
