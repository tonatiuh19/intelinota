-- Migration: keep old section URLs working after a slug change
-- Date: 2026-11-26 17:00:00

CREATE TABLE IF NOT EXISTS `category_slug_redirects` (
  `old_slug` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category_id` int(10) UNSIGNED NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`old_slug`),
  KEY `idx_category_redirects_category` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
