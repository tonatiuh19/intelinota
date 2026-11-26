-- Migration: store hashed IP on comments for spam throttling
-- Date: 2026-11-25 12:01:00

ALTER TABLE `comments`
  ADD COLUMN `ip_hash` char(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `author_email`;
ALTER TABLE `comments`
  ADD KEY `idx_comments_ip_created` (`ip_hash`, `created_at`);
