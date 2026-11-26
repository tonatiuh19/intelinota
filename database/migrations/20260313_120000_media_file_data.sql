-- Migration: store uploaded media bytes in DB for self-hosted serving
-- Date: 2026-03-13 12:00:00

ALTER TABLE `media`
  ADD COLUMN `file_data` LONGBLOB NULL AFTER `url`;
