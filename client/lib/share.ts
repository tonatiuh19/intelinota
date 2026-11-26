const BOOKMARKS_KEY = "intelinota_bookmarks";
export const BOOKMARKS_CHANGED = "intelinota:bookmarks-changed";

function notifyBookmarksChanged() {
  window.dispatchEvent(new CustomEvent(BOOKMARKS_CHANGED));
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
  try {
    return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function isBookmarked(slug: string): boolean {
  return getBookmarks().includes(slug);
}

export function getBookmarkCount(): number {
  return getBookmarks().length;
}

export function removeBookmark(slug: string): void {
  const bookmarks = getBookmarks().filter((s) => s !== slug);
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
  notifyBookmarksChanged();
}

export function toggleBookmark(slug: string): boolean {
  const bookmarks = getBookmarks();
  const idx = bookmarks.indexOf(slug);
  if (idx >= 0) {
    bookmarks.splice(idx, 1);
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
    notifyBookmarksChanged();
    return false;
  }
  bookmarks.push(slug);
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
  notifyBookmarksChanged();
  return true;
}
