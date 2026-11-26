const BOOKMARKS_KEY = "intelinota_bookmarks";
/** slug → { savedAt, readAt } (added later; old bookmarks get defaults) */
const BOOKMARK_META_KEY = "intelinota_bookmark_meta";
export const BOOKMARKS_CHANGED = "intelinota:bookmarks-changed";
const MAX_BOOKMARKS = 100;

export interface BookmarkMeta {
  savedAt: number;
  readAt: number | null;
}

function notifyBookmarksChanged() {
  window.dispatchEvent(new CustomEvent(BOOKMARKS_CHANGED));
}

function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / unavailable */
  }
}

export async function sharePage(title: string, url: string): Promise<"shared" | "copied"> {
  if (navigator.share) {
    await navigator.share({ title, url });
    return "shared";
  }
  await navigator.clipboard.writeText(url);
  return "copied";
}

export function getBookmarks(): string[] {
  const list = safeGet<unknown>(BOOKMARKS_KEY, []);
  return Array.isArray(list) ? list.filter((s): s is string => typeof s === "string") : [];
}

export function getBookmarkMeta(): Record<string, BookmarkMeta> {
  const meta = safeGet<Record<string, BookmarkMeta>>(BOOKMARK_META_KEY, {});
  // Legacy bookmarks (saved before meta existed) get a stable default
  const out: Record<string, BookmarkMeta> = {};
  for (const slug of getBookmarks()) {
    out[slug] = meta[slug] ?? { savedAt: 0, readAt: null };
  }
  return out;
}

function writeMeta(meta: Record<string, BookmarkMeta>) {
  safeSet(BOOKMARK_META_KEY, meta);
}

export function isBookmarked(slug: string): boolean {
  return getBookmarks().includes(slug);
}

export function getBookmarkCount(): number {
  return getBookmarks().length;
}

export function removeBookmark(slug: string): void {
  safeSet(BOOKMARKS_KEY, getBookmarks().filter((s) => s !== slug));
  const meta = safeGet<Record<string, BookmarkMeta>>(BOOKMARK_META_KEY, {});
  delete meta[slug];
  writeMeta(meta);
  notifyBookmarksChanged();
}

/** Re-adds a bookmark with its previous metadata (undo). */
export function restoreBookmark(slug: string, prev?: BookmarkMeta): void {
  const list = getBookmarks();
  if (!list.includes(slug)) safeSet(BOOKMARKS_KEY, [...list, slug].slice(-MAX_BOOKMARKS));
  const meta = safeGet<Record<string, BookmarkMeta>>(BOOKMARK_META_KEY, {});
  meta[slug] = prev ?? { savedAt: Date.now(), readAt: null };
  writeMeta(meta);
  notifyBookmarksChanged();
}

export function clearBookmarks(): void {
  safeSet(BOOKMARKS_KEY, []);
  writeMeta({});
  notifyBookmarksChanged();
}

export function toggleBookmark(slug: string): boolean {
  if (isBookmarked(slug)) {
    removeBookmark(slug);
    return false;
  }
  restoreBookmark(slug);
  return true;
}

/** Marks a saved article read/unread. No-op if it isn't bookmarked. */
export function setBookmarkRead(slug: string, read: boolean): void {
  if (!isBookmarked(slug)) return;
  const meta = safeGet<Record<string, BookmarkMeta>>(BOOKMARK_META_KEY, {});
  const cur = meta[slug] ?? { savedAt: 0, readAt: null };
  if (Boolean(cur.readAt) === read) return;
  meta[slug] = { ...cur, readAt: read ? Date.now() : null };
  writeMeta(meta);
  notifyBookmarksChanged();
}
