-- Migration: manual ordering for subcategories (admin Categories redesign)
-- Date: 2026-11-26 16:00:00
-- TiDB: one change per ALTER statement.
ALTER TABLE `subcategories` ADD COLUMN `sort_order` SMALLINT UNSIGNED NOT NULL DEFAULT 0;

ALTER TABLE `subcategories` ADD KEY `idx_subcategories_sort` (`category_id`, `sort_order`);

-- Seed current alphabetical order so nothing visibly changes.
UPDATE `subcategories` s
JOIN (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY name ASC) AS rn
  FROM `subcategories`
) o ON o.id = s.id
SET s.sort_order = o.rn;
