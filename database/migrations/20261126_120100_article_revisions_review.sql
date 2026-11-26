-- Migration: pending (proposed) edits stored as article revisions
-- Date: 2026-11-26 12:01:00
-- TiDB: one change per ALTER statement.
ALTER TABLE `article_revisions`
  ADD COLUMN `kind` enum('snapshot','pending') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'snapshot';

ALTER TABLE `article_revisions`
  ADD COLUMN `review_status` enum('pending','approved','rejected') COLLATE utf8mb4_unicode_ci DEFAULT NULL;

ALTER TABLE `article_revisions`
  ADD COLUMN `reviewed_by` int(10) UNSIGNED DEFAULT NULL;

ALTER TABLE `article_revisions`
  ADD COLUMN `reviewed_at` timestamp NULL DEFAULT NULL;

ALTER TABLE `article_revisions`
  ADD KEY `idx_revisions_kind_review` (`kind`, `review_status`);
