-- Migration: keep old slugs of published articles resolvable (301)
-- Date: 2026-11-26 12:05:00
CREATE TABLE IF NOT EXISTS `article_slug_redirects` (
  `old_slug` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `article_id` int(10) UNSIGNED NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`old_slug`),
  KEY `idx_slug_redirects_article` (`article_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
