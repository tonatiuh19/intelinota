-- Migration: comment risk scoring + moderation helpers
-- Date: 2026-11-26 14:00:00
-- (TiDB: one change per ALTER)

ALTER TABLE `comments`
  ADD COLUMN `spam_score` tinyint(3) UNSIGNED NOT NULL DEFAULT '0' AFTER `status`;
ALTER TABLE `comments`
  ADD COLUMN `flags` json DEFAULT NULL AFTER `spam_score`;
ALTER TABLE `comments`
  ADD KEY `idx_comments_status_created` (`status`, `created_at`);
ALTER TABLE `comments`
  ADD KEY `idx_comments_email` (`author_email`);

INSERT IGNORE INTO `system_settings` (`setting_key`, `setting_value`, `setting_type`, `description`)
VALUES (
  'comment_blocklist',
  'casino,viagra,apuestas online,criptomonedas gratis,onlyfans,porn,xxx',
  'string',
  'Comma-separated words/phrases that flag a comment as likely spam.'
);
