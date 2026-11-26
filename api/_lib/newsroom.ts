import type { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";

/** Lower-case, accent-free, URL-safe slug. */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

/** Replaces an article's tags with the given names (creating tags as needed). */
export async function setArticleTags(
  pool: Pool,
  articleId: number,
  names: string[],
): Promise<void> {
  const clean = Array.from(
    new Map(
      names
        .map((n) => String(n).trim().slice(0, 100))
        .filter(Boolean)
        .map((n) => [slugify(n), n] as const)
        .filter(([slug]) => slug.length > 0),
    ),
  ).slice(0, 12);

  await pool.query("DELETE FROM article_tags WHERE article_id = ?", [articleId]);
  if (!clean.length) return;

  await pool.query(
    `INSERT INTO tags (name, slug) VALUES ${clean.map(() => "(?, ?)").join(", ")}
     ON DUPLICATE KEY UPDATE name = name`,
    clean.flatMap(([slug, name]) => [name, slug]),
  );
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM tags WHERE slug IN (${clean.map(() => "?").join(", ")})`,
    clean.map(([slug]) => slug),
  );
  if (rows.length) {
    await pool.query("INSERT IGNORE INTO article_tags (article_id, tag_id) VALUES ?", [
      rows.map((r) => [articleId, r.id]),
    ]);
  }
}

export async function getArticleTags(
  pool: Pool,
  articleId: number,
): Promise<Array<{ id: number; name: string; slug: string }>> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT t.id, t.name, t.slug FROM article_tags at
     JOIN tags t ON t.id = at.tag_id
     WHERE at.article_id = ? ORDER BY t.name`,
    [articleId],
  );
  return rows as Array<{ id: number; name: string; slug: string }>;
}

/** Stores a full snapshot of the article (fields + blocks + tags). */
export async function saveRevision(
  pool: Pool,
  articleId: number,
  userId: number | null,
): Promise<void> {
  try {
    await saveRevisionUnsafe(pool, articleId, userId);
  } catch (error) {
    // Revisions are a safety net — never block the primary save
    console.error("saveRevision failed:", error);
  }
}

async function saveRevisionUnsafe(
  pool: Pool,
  articleId: number,
  userId: number | null,
): Promise<void> {
  const [[articleRows], [blockRows], tags] = await Promise.all([
    pool.query<RowDataPacket[]>(
      `SELECT id, slug, title, excerpt, content, category_id, subcategory_id, author_id,
              image_url, read_time_minutes, featured, trending, status, published_at
       FROM articles WHERE id = ? LIMIT 1`,
      [articleId],
    ),
    pool.query<RowDataPacket[]>(
      "SELECT position, type, data FROM article_blocks WHERE article_id = ? ORDER BY position",
      [articleId],
    ),
    getArticleTags(pool, articleId),
  ]);
  const article = articleRows[0];
  if (!article) return;
  await pool.query(
    `INSERT INTO article_revisions (article_id, user_id, title, status, snapshot)
     VALUES (?, ?, ?, ?, ?)`,
    [
      articleId,
      userId,
      article.title,
      article.status,
      JSON.stringify({
        article,
        blocks: blockRows.map((b) => ({
          position: b.position,
          type: b.type,
          data: typeof b.data === "string" ? JSON.parse(b.data) : b.data,
        })),
        tags: tags.map((t) => t.name),
      }),
    ],
  );
  // Keep the 50 most recent revisions per article
  await pool.query(
    `DELETE FROM article_revisions WHERE article_id = ? AND id NOT IN (
       SELECT id FROM (SELECT id FROM article_revisions WHERE article_id = ?
                       ORDER BY created_at DESC, id DESC LIMIT 50) keep)`,
    [articleId, articleId],
  );
}

export async function audit(
  pool: Pool,
  entry: {
    userId: number | null;
    action: string;
    entityType: string;
    entityId?: number | null;
    details?: Record<string, unknown>;
    ipHash?: string | null;
  },
): Promise<void> {
  try {
    await pool.query<ResultSetHeader>(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, ip_hash)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        entry.userId,
        entry.action,
        entry.entityType,
        entry.entityId ?? null,
        entry.details ? JSON.stringify(entry.details) : null,
        entry.ipHash ?? null,
      ],
    );
  } catch (error) {
    // Audit must never break the primary action
    console.error("audit log failed:", error);
  }
}
