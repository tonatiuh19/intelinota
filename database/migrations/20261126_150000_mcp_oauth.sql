-- Intelinota — Remote MCP OAuth 2.1 (Claude / Cursor connectors)
-- TiDB Cloud (MySQL 8.0 compatible). Tables are new: CREATE TABLE only,
-- no ALTERs. Tokens and codes are stored ONLY as sha256 hashes.
-- user_id → users.id (role IN ('admin','author') enforced in code on every request).

CREATE TABLE IF NOT EXISTS `mcp_oauth_clients` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `client_id` VARCHAR(128) NOT NULL,
  `client_name` VARCHAR(255) DEFAULT NULL,
  `redirect_uris_json` JSON NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_mcp_client_id` (`client_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mcp_oauth_codes` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code_hash` CHAR(64) NOT NULL,
  `client_id` VARCHAR(128) NOT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  `redirect_uri` VARCHAR(1000) NOT NULL,
  `code_challenge` VARCHAR(128) NOT NULL,
  `code_challenge_method` VARCHAR(16) NOT NULL DEFAULT 'S256',
  `scopes` VARCHAR(255) NOT NULL DEFAULT 'intelinota.newsroom',
  `expires_at` DATETIME NOT NULL,
  `consumed_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_mcp_code_hash` (`code_hash`),
  KEY `idx_mcp_codes_user` (`user_id`),
  KEY `idx_mcp_codes_expires` (`expires_at`),
  CONSTRAINT `fk_mcp_codes_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mcp_oauth_tokens` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `token_hash` CHAR(64) NOT NULL,
  `refresh_token_hash` CHAR(64) DEFAULT NULL,
  `client_id` VARCHAR(128) NOT NULL,
  `client_name` VARCHAR(255) DEFAULT NULL,
  `user_id` INT UNSIGNED NOT NULL,
  `scopes` VARCHAR(255) NOT NULL DEFAULT 'intelinota.newsroom',
  `expires_at` DATETIME NOT NULL COMMENT 'Access token expiry (1h)',
  `refresh_expires_at` DATETIME DEFAULT NULL COMMENT 'Refresh token expiry (30d, rotated on use)',
  `revoked_at` DATETIME DEFAULT NULL,
  `last_used_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_mcp_token_hash` (`token_hash`),
  UNIQUE KEY `uq_mcp_refresh_hash` (`refresh_token_hash`),
  KEY `idx_mcp_tokens_user` (`user_id`, `revoked_at`),
  KEY `idx_mcp_tokens_refresh_expires` (`refresh_expires_at`),
  CONSTRAINT `fk_mcp_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `mcp_audit_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED DEFAULT NULL,
  `client_id` VARCHAR(128) DEFAULT NULL,
  `tool_name` VARCHAR(120) NOT NULL,
  `confirm` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = executed write, 0 = read or dry-run',
  `ok` TINYINT(1) NOT NULL DEFAULT 1,
  `status_code` SMALLINT UNSIGNED DEFAULT NULL,
  `duration_ms` INT UNSIGNED DEFAULT NULL,
  `request_json` JSON DEFAULT NULL COMMENT 'Redacted/truncated args',
  `result_json` JSON DEFAULT NULL COMMENT 'Truncated result',
  `error_message` VARCHAR(500) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_mcp_audit_user` (`user_id`, `id`),
  KEY `idx_mcp_audit_tool` (`tool_name`, `created_at`),
  CONSTRAINT `fk_mcp_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
