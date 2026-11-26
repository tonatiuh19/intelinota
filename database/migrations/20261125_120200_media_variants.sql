-- Migration: responsive image variants stored on Vercel Blob
-- Date: 2026-11-25 12:02:00

ALTER TABLE `media`
  ADD COLUMN `storage` enum('db','blob') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'db' AFTER `file_data`;
ALTER TABLE `media`
  ADD COLUMN `variants` json DEFAULT NULL COMMENT 'Array of {width,url} WebP renditions' AFTER `storage`;
