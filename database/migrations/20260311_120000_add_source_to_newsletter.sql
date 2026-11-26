-- Migration: align newsletter_subscribers with API (add source column)
-- Date: 2026-03-11 12:00:00

ALTER TABLE `newsletter_subscribers`
  ADD COLUMN `source` VARCHAR(64) NULL
    COMMENT 'Signup source: footer, sidebar, category, etc.'
    AFTER `name`;
