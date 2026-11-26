-- Migration: newsletter double opt-in + unsubscribe tokens
-- Date: 2026-11-25 12:00:00
-- (One change per statement: TiDB cannot reference a column added in the same ALTER.)

ALTER TABLE `newsletter_subscribers`
  MODIFY COLUMN `status` enum('pending','active','unsubscribed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending';
ALTER TABLE `newsletter_subscribers`
  ADD COLUMN `confirm_token` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `status`;
ALTER TABLE `newsletter_subscribers`
  ADD COLUMN `unsubscribe_token` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `confirm_token`;
ALTER TABLE `newsletter_subscribers`
  ADD COLUMN `confirmed_at` timestamp NULL DEFAULT NULL AFTER `subscribed_at`;
ALTER TABLE `newsletter_subscribers`
  ADD UNIQUE KEY `uq_newsletter_confirm_token` (`confirm_token`);
ALTER TABLE `newsletter_subscribers`
  ADD UNIQUE KEY `uq_newsletter_unsubscribe_token` (`unsubscribe_token`);

-- Existing active subscribers are considered confirmed
UPDATE `newsletter_subscribers`
  SET `confirmed_at` = `subscribed_at`
  WHERE `status` = 'active' AND `confirmed_at` IS NULL;
