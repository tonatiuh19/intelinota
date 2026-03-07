-- =============================================================
-- Migration: 20260306_120000
-- Add is_active and sort_order to categories table
-- MySQL 8.0 compatible
-- =============================================================

ALTER TABLE categories
  ADD COLUMN is_active  TINYINT(1)        NOT NULL DEFAULT 1 AFTER description,
  ADD COLUMN sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER is_active;

-- Indexes for common filter/sort queries
ALTER TABLE categories
  ADD INDEX idx_is_active  (is_active),
  ADD INDEX idx_sort_order (sort_order);

-- Set display order for existing seed categories (matches nav menu order)
UPDATE categories SET sort_order = 1 WHERE slug = 'deportes';
UPDATE categories SET sort_order = 2 WHERE slug = 'tecnologia';
UPDATE categories SET sort_order = 3 WHERE slug = 'videojuegos';
UPDATE categories SET sort_order = 4 WHERE slug = 'cine';
UPDATE categories SET sort_order = 5 WHERE slug = 'mundo';

-- All existing categories remain active (DEFAULT 1 already applied above)
