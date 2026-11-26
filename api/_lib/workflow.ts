import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { escapeHtml } from "./security.js";

/** Anything with mysql2's `query` (a Pool or a PoolConnection inside a transaction). */
export type Queryable = Pick<PoolConnection, "query">;

export type NotificationType =
  | "review.submitted"
  | "review.approved"
  | "review.published"
  | "review.returned"
  | "revision.submitted"
  | "revision.approved"
  | "revision.rejected"
  | "comment.pending";

export interface NotificationInput {
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
}

/** Article snapshot shape shared by saveRevision and pending revisions. */
export interface ArticleSnapshot {
  article: Record<string, unknown>;
  blocks: Array<{ position: number; type: string; data: unknown }>;
  tags?: string[];
}

export function parseSnapshot(value: unknown): ArticleSnapshot {
  const raw = typeof value === "string" ? JSON.parse(value) : value;
  const snap = (raw ?? {}) as Partial<ArticleSnapshot>;
  return {
    article: (snap.article ?? {}) as Record<string, unknown>,
    blocks: Array.isArray(snap.blocks) ? snap.blocks : [],
    tags: Array.isArray(snap.tags) ? snap.tags.map(String) : undefined,
  };
}

/** Next free slug: `base`, else `base-2`, `base-3`… given the taken set. */
export function suggestSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const TEXT_KEYS = new Set(["html", "text", "caption", "author", "alt", "title", "source"]);

/** Readable plain text of an article (legacy content + text-bearing blocks). */
export function snapshotPlainText(snap: ArticleSnapshot): string {
  const parts: string[] = [];
  const content = snap.article.content;
  if (typeof content === "string" && content) parts.push(stripTags(content));
  for (const b of [...snap.blocks].sort((x, y) => x.position - y.position)) {
    const data = (b.data ?? {}) as Record<string, unknown>;
    for (const [k, v] of Object.entries(data)) {
      if (TEXT_KEYS.has(k) && typeof v === "string" && v.trim()) parts.push(stripTags(v));
    }
  }
  return parts.join("\n").slice(0, 200_000);
}

export async function getAdminUserIds(db: Queryable): Promise<number[]> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT id FROM users WHERE role = 'admin'");
  return rows.map((r) => Number(r.id));
}

export async function getAuthorUserIds(db: Queryable, authorId: number): Promise<number[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT id FROM users WHERE author_id = ? AND role IN ('admin','author')",
    [authorId],
  );
  return rows.map((r) => Number(r.id));
}

export function notificationEmailHtml(n: NotificationInput, baseUrl: string): string {
  const href = n.link ? `${baseUrl.replace(/\/$/, "")}${n.link}` : null;
  return `<!DOCTYPE html><html lang="es"><body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px">
<tr><td>
<p style="margin:0 0 8px;font-size:12px;letter-spacing:2px;color:#71717a">INTELINOTA · REDACCIÓN</p>
<h1 style="margin:0 0 12px;font-size:20px">${escapeHtml(n.title)}</h1>
${n.body ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.5;white-space:pre-line">${escapeHtml(n.body)}</p>` : ""}
${href ? `<a href="${escapeHtml(href)}" style="display:inline-block;padding:10px 18px;background:#18181b;color:#ffffff;border-radius:8px;text-decoration:none;font-size:14px">Abrir en el panel</a>` : ""}
</td></tr></table></body></html>`;
}

/**
 * Inserts one notification per recipient (excluding `exceptUserId`) and
 * emails them. Never throws: notifications are a side effect.
 */
export async function notifyUsers(
  db: Queryable,
  userIds: number[],
  n: NotificationInput,
  opts: {
    exceptUserId?: number | null;
    sendEmail?: (to: string, subject: string, html: string) => Promise<void>;
    baseUrl: string;
  },
): Promise<void> {
  const ids = Array.from(new Set(userIds)).filter((id) => id && id !== opts.exceptUserId);
  if (!ids.length) return;
  try {
    await db.query<ResultSetHeader>(
      "INSERT INTO notifications (user_id, type, title, body, link) VALUES ?",
      [ids.map((id) => [id, n.type, n.title.slice(0, 255), n.body ?? null, n.link?.slice(0, 512) ?? null])],
    );
  } catch (error) {
    console.error("notification insert failed:", error);
  }
  const send = opts.sendEmail;
  if (!send) return;
  try {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT email FROM users WHERE id IN (${ids.map(() => "?").join(", ")})`,
      ids,
    );
    const html = notificationEmailHtml(n, opts.baseUrl);
    const jobs = Promise.allSettled(
      rows.map((r) => send(String(r.email), `[Intelinota] ${n.title}`.slice(0, 200), html)),
    );
    // Bounded wait so a slow mail provider never stalls the request
    await Promise.race([jobs, new Promise((resolve) => setTimeout(resolve, 3000))]);
    void jobs.then((results) =>
      results.forEach((r) => {
        if (r.status === "rejected") console.error("notification email failed:", r.reason);
      }),
    );
  } catch (error) {
    console.error("notification email lookup failed:", error);
  }
}
