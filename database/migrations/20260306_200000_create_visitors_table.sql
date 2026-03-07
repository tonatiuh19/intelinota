-- Migration: create visitors table
-- Created: 2026-03-06
-- Description: Full visitor / pageview event tracking table.
--   - Privacy-safe: raw IP is never stored; only SHA-256(ip + salt)
--   - Fire-and-forget inserts — never blocks API responses
--   - Covers: session identity, geo (header-derived), UA breakdown,
--     event type, traffic source (UTM), auth context

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Create table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `visitors` (
  `id`               BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,

  -- Session / identity
  `session_id`       VARCHAR(64)  NOT NULL COMMENT 'Anonymous session ID — UUID sent via X-Session-Id header or server-derived fallback',
  `ip_hash`          VARCHAR(64)  NOT NULL COMMENT 'SHA-256(raw_ip + VISITORS_SALT env var) — never stores the raw IP address',

  -- Geolocation (read from CDN/proxy headers, no external API call)
  `ip_country`       VARCHAR(2)   DEFAULT NULL COMMENT 'ISO 3166-1 alpha-2 from CF-IPCountry or x-vercel-ip-country',
  `ip_city`          VARCHAR(100) DEFAULT NULL COMMENT 'City name from x-vercel-ip-city (Vercel deployments only)',

  -- User-Agent breakdown
  `user_agent`       VARCHAR(512) DEFAULT NULL,
  `browser`          VARCHAR(50)  DEFAULT NULL,
  `browser_version`  VARCHAR(20)  DEFAULT NULL,
  `os`               VARCHAR(50)  DEFAULT NULL,
  `device_type`      ENUM('desktop','mobile','tablet','bot','unknown') NOT NULL DEFAULT 'unknown',
  `is_bot`           TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '1 when UA matches a known bot/crawler pattern',

  -- Page / event
  `event_type`       ENUM('home_view','article_view','category_view','search','other') NOT NULL DEFAULT 'other',
  `page_path`        VARCHAR(500) NOT NULL COMMENT 'URL path that was accessed',
  `article_id`       INT(10) UNSIGNED DEFAULT NULL COMMENT 'FK → articles.id, set for article_view events',
  `category_id`      INT(10) UNSIGNED DEFAULT NULL COMMENT 'FK → categories.id, set for category_view events',

  -- Traffic source
  `referrer`         VARCHAR(500) DEFAULT NULL COMMENT 'Full Referer header value (truncated to 500 chars)',
  `referrer_domain`  VARCHAR(150) DEFAULT NULL COMMENT 'Parsed hostname of the referrer',
  `utm_source`       VARCHAR(100) DEFAULT NULL,
  `utm_medium`       VARCHAR(100) DEFAULT NULL,
  `utm_campaign`     VARCHAR(100) DEFAULT NULL,
  `utm_content`      VARCHAR(100) DEFAULT NULL,
  `utm_term`         VARCHAR(100) DEFAULT NULL,

  -- Auth context
  `user_id`          INT(10) UNSIGNED DEFAULT NULL COMMENT 'FK → users.id — NULL for anonymous visitors',

  `created_at`       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Per-request visitor/pageview event log — fire-and-forget inserts, never blocks API responses';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Indexes
-- ─────────────────────────────────────────────────────────────────────────────

-- Dashboards filter by event type + date range most often
ALTER TABLE `visitors`
  ADD KEY `idx_event_created`    (`event_type`, `created_at`),
  ADD KEY `idx_session`          (`session_id`),
  ADD KEY `idx_ip_hash`          (`ip_hash`),
  ADD KEY `idx_article`          (`article_id`),
  ADD KEY `idx_category`         (`category_id`),
  ADD KEY `idx_created`          (`created_at`),
  ADD KEY `idx_country_created`  (`ip_country`, `created_at`),
  ADD KEY `idx_user`             (`user_id`);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Foreign keys (all SET NULL on delete to keep historical rows intact)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE `visitors`
  ADD CONSTRAINT `visitors_ibfk_1`
    FOREIGN KEY (`article_id`)  REFERENCES `articles`   (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `visitors_ibfk_2`
    FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `visitors_ibfk_3`
    FOREIGN KEY (`user_id`)     REFERENCES `users`      (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
