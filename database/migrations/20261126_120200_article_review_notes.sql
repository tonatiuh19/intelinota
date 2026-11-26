-- Migration: editorial review feedback notes
-- Date: 2026-11-26 12:02:00
CREATE TABLE IF NOT EXISTS `article_review_notes` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `article_id` int(10) UNSIGNED NOT NULL,
  `revision_id` int(10) UNSIGNED DEFAULT NULL,
  `user_id` int(10) UNSIGNED DEFAULT NULL,
  `action` enum('returned','approved','published','comment') COLLATE utf8mb4_unicode_ci NOT NULL,
  `note` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_review_notes_article` (`article_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
