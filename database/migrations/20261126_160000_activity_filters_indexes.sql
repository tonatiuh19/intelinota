-- Activity page filters (GET /api/admin/audit?user_id=&type=&from=&to=&include_mcp=1)
-- TiDB: one change per ALTER statement.

-- "Usuario" filter + date range on the newsroom audit log
ALTER TABLE `audit_log` ADD INDEX `idx_audit_user_created` (`user_id`, `created_at`);

-- Merged "vía IA" feed: executed MCP writes ordered by time
ALTER TABLE `mcp_audit_logs` ADD INDEX `idx_mcp_audit_confirm_created` (`confirm`, `created_at`);
