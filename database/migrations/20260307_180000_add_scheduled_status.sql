-- Migration: Add 'scheduled' status to articles table
-- Date: 2026-03-07
-- Description: Allows articles to be scheduled for future automatic publication
--              by a cron job.  The cron hits POST /api/cron/publish-scheduled.

ALTER TABLE `articles`
  MODIFY COLUMN `status`
    ENUM('draft','published','archived','scheduled')
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    NOT NULL DEFAULT 'draft';
