-- Migration: trusted authors may publish their own articles
-- Date: 2026-11-26 12:00:00
ALTER TABLE `users`
  ADD COLUMN `can_publish` tinyint(1) NOT NULL DEFAULT '0' AFTER `role`;
