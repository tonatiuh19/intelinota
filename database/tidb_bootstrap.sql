-- =============================================================
-- Intelinota — TiDB / MySQL bootstrap schema (structure only)
-- Apply to an empty database before importing data.
--
-- Usage:
--   ./database/scripts/bootstrap-tidb.sh
--   ./database/scripts/export-data.sh    # backup data from TiDB (optional)
--   ./database/scripts/import-data.sh    # into TiDB
--
-- Compatible with: TiDB Cloud Serverless, MySQL 8.0+
-- =============================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;

-- ── Authors ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `authors` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `slug` VARCHAR(150) NOT NULL,
  `bio` TEXT NULL,
  `avatar_url` VARCHAR(512) NULL,
  `email` VARCHAR(255) NULL,
  `twitter_handle` VARCHAR(100) NULL,
  `social_links` JSON NULL COMMENT 'Social URLs: facebook, instagram, linkedin, youtube, tiktok, website',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_authors_slug` (`slug`),
  UNIQUE KEY `uq_authors_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Categories ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `categories` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_categories_slug` (`slug`),
  KEY `idx_categories_is_active` (`is_active`),
  KEY `idx_categories_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `subcategories` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `category_id` INT UNSIGNED NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(100) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_subcategory_slug` (`category_id`, `slug`),
  CONSTRAINT `fk_subcategories_category`
    FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Users & admin auth ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NULL,
  `name` VARCHAR(150) NULL,
  `avatar_url` VARCHAR(512) NULL,
  `role` ENUM('admin','editor','reader','author') NOT NULL DEFAULT 'reader',
  `email_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `verification_token` VARCHAR(255) NULL,
  `reset_token` VARCHAR(255) NULL,
  `reset_token_expires_at` TIMESTAMP NULL DEFAULT NULL,
  `author_id` INT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  KEY `idx_users_author_id` (`author_id`),
  CONSTRAINT `fk_users_author`
    FOREIGN KEY (`author_id`) REFERENCES `authors` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `admin_login_codes` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL,
  `code` VARCHAR(64) NOT NULL,
  `expires_at` TIMESTAMP NOT NULL,
  `used` TINYINT(1) NOT NULL DEFAULT 0,
  `ip_hash` VARCHAR(64) NULL COMMENT 'SHA-256 of requester IP',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_email_expires` (`email`, `expires_at`),
  KEY `idx_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Short-lived OTP codes for admin/author email login';

CREATE TABLE IF NOT EXISTS `admin_login_attempts` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL,
  `ip_hash` VARCHAR(64) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_attempts_email_created` (`email`, `created_at`),
  KEY `idx_attempts_ip_created` (`ip_hash`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Articles ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `articles` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `slug` VARCHAR(255) NOT NULL,
  `title` VARCHAR(500) NOT NULL,
  `excerpt` TEXT NULL,
  `content` LONGTEXT NULL,
  `category_id` INT UNSIGNED NOT NULL,
  `subcategory_id` INT UNSIGNED NULL,
  `author_id` INT UNSIGNED NOT NULL,
  `image_url` VARCHAR(512) NULL,
  `read_time_minutes` SMALLINT UNSIGNED NOT NULL DEFAULT 5,
  `featured` TINYINT(1) NOT NULL DEFAULT 0,
  `trending` TINYINT(1) NOT NULL DEFAULT 0,
  `status` ENUM('draft','published','archived','scheduled') NOT NULL DEFAULT 'draft',
  `published_at` TIMESTAMP NULL DEFAULT NULL,
  `view_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_articles_slug` (`slug`),
  KEY `idx_articles_category` (`category_id`),
  KEY `idx_articles_subcategory` (`subcategory_id`),
  KEY `idx_articles_author` (`author_id`),
  KEY `idx_articles_status_published` (`status`, `published_at`),
  KEY `idx_articles_featured` (`featured`),
  KEY `idx_articles_trending` (`trending`),
  CONSTRAINT `fk_articles_category`
    FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
    ON UPDATE CASCADE,
  CONSTRAINT `fk_articles_subcategory`
    FOREIGN KEY (`subcategory_id`) REFERENCES `subcategories` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_articles_author`
    FOREIGN KEY (`author_id`) REFERENCES `authors` (`id`)
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `article_blocks` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `article_id` INT UNSIGNED NOT NULL,
  `position` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `type` ENUM('html','image','youtube','twitter','instagram','quote','divider') NOT NULL,
  `data` JSON NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_article_blocks_position` (`article_id`, `position`),
  CONSTRAINT `fk_article_blocks_article`
    FOREIGN KEY (`article_id`) REFERENCES `articles` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Tags ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `tags` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(100) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tags_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `article_tags` (
  `article_id` INT UNSIGNED NOT NULL,
  `tag_id` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`article_id`, `tag_id`),
  KEY `idx_article_tags_tag` (`tag_id`),
  CONSTRAINT `fk_article_tags_article`
    FOREIGN KEY (`article_id`) REFERENCES `articles` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_article_tags_tag`
    FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Comments ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `comments` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `article_id` INT UNSIGNED NOT NULL,
  `user_id` INT UNSIGNED NULL,
  `parent_id` INT UNSIGNED NULL,
  `author_name` VARCHAR(150) NULL,
  `author_email` VARCHAR(255) NULL,
  `content` TEXT NOT NULL,
  `status` ENUM('pending','approved','spam') NOT NULL DEFAULT 'pending',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_comments_user` (`user_id`),
  KEY `idx_comments_parent` (`parent_id`),
  KEY `idx_comments_article_status` (`article_id`, `status`),
  CONSTRAINT `fk_comments_article`
    FOREIGN KEY (`article_id`) REFERENCES `articles` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_comments_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_comments_parent`
    FOREIGN KEY (`parent_id`) REFERENCES `comments` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Media ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `media` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `filename` VARCHAR(255) NOT NULL,
  `url` VARCHAR(512) NOT NULL,
  `file_data` LONGBLOB NULL,
  `mime_type` VARCHAR(100) NULL,
  `size_bytes` INT UNSIGNED NULL,
  `width` SMALLINT UNSIGNED NULL,
  `height` SMALLINT UNSIGNED NULL,
  `alt_text` VARCHAR(255) NULL,
  `uploaded_by` INT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_media_uploaded_by` (`uploaded_by`),
  CONSTRAINT `fk_media_user`
    FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Newsletter ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `newsletter_subscribers` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(255) NOT NULL,
  `name` VARCHAR(150) NULL,
  `source` VARCHAR(64) NULL COMMENT 'Signup source: footer, sidebar, category, etc.',
  `status` ENUM('active','unsubscribed') NOT NULL DEFAULT 'active',
  `subscribed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `unsubscribed_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_newsletter_email` (`email`),
  KEY `idx_newsletter_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Visitor analytics ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS `visitors` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `session_id` VARCHAR(64) NOT NULL,
  `ip_hash` VARCHAR(64) NOT NULL,
  `ip_country` VARCHAR(2) NULL,
  `ip_city` VARCHAR(100) NULL,
  `user_agent` VARCHAR(512) NULL,
  `browser` VARCHAR(50) NULL,
  `browser_version` VARCHAR(20) NULL,
  `os` VARCHAR(50) NULL,
  `device_type` ENUM('desktop','mobile','tablet','bot','unknown') NOT NULL DEFAULT 'unknown',
  `is_bot` TINYINT(1) NOT NULL DEFAULT 0,
  `event_type` ENUM('home_view','article_view','category_view','search','other') NOT NULL DEFAULT 'other',
  `page_path` VARCHAR(500) NOT NULL,
  `article_id` INT UNSIGNED NULL,
  `category_id` INT UNSIGNED NULL,
  `referrer` VARCHAR(500) NULL,
  `referrer_domain` VARCHAR(150) NULL,
  `utm_source` VARCHAR(100) NULL,
  `utm_medium` VARCHAR(100) NULL,
  `utm_campaign` VARCHAR(100) NULL,
  `utm_content` VARCHAR(100) NULL,
  `utm_term` VARCHAR(100) NULL,
  `user_id` INT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_visitors_event_created` (`event_type`, `created_at`),
  KEY `idx_visitors_session` (`session_id`),
  KEY `idx_visitors_ip_hash` (`ip_hash`),
  KEY `idx_visitors_article` (`article_id`),
  KEY `idx_visitors_category` (`category_id`),
  KEY `idx_visitors_created` (`created_at`),
  KEY `idx_visitors_country_created` (`ip_country`, `created_at`),
  KEY `idx_visitors_user` (`user_id`),
  CONSTRAINT `fk_visitors_article`
    FOREIGN KEY (`article_id`) REFERENCES `articles` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_visitors_category`
    FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_visitors_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Per-request visitor/pageview event log';

-- ── System settings ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `system_settings` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `setting_key` VARCHAR(100) NOT NULL,
  `setting_value` TEXT NULL,
  `setting_type` ENUM('string','number','boolean','json') NOT NULL DEFAULT 'string',
  `description` TEXT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_system_settings_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `system_settings` (`setting_key`, `setting_value`, `setting_type`, `description`)
VALUES (
  'app_version',
  'v1.0.0',
  'string',
  'Current deployed application version shown in the site footer.'
)
ON DUPLICATE KEY UPDATE
  `setting_value` = VALUES(`setting_value`),
  `description` = VALUES(`description`);

SET FOREIGN_KEY_CHECKS = 1;

-- ── Optional seed (categories only — import full data separately) ──
-- Uncomment after bootstrap if starting fresh without a data dump:

/*
INSERT INTO categories (id, name, slug, description, is_active, sort_order) VALUES
(1, 'Tecnología', 'tecnologia', 'Noticias de tecnología, IA, startups y gadgets', 1, 2),
(2, 'Deportes', 'deportes', 'Cobertura de fútbol, tenis, esports y más', 1, 1),
(3, 'Cine', 'cine', 'Películas, series de TV y críticas', 1, 4),
(4, 'Videojuegos', 'videojuegos', 'Reseñas, esports y cultura gamer', 1, 3),
(5, 'Mundo', 'mundo', 'Política, economía y ciencia global', 1, 5);
*/
