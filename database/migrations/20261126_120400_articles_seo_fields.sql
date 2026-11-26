-- Migration: per-article SEO overrides
-- Date: 2026-11-26 12:04:00
-- TiDB: one change per ALTER statement.
ALTER TABLE `articles`
  ADD COLUMN `meta_title` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL;

ALTER TABLE `articles`
  ADD COLUMN `meta_description` varchar(320) COLLATE utf8mb4_unicode_ci DEFAULT NULL;
