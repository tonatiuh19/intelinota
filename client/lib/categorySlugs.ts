/** DB category slug → public URL segment (English-style paths). */
export const DB_SLUG_TO_URL: Record<string, string> = {
  deportes: "sports",
  tecnologia: "technology",
  videojuegos: "video-games",
  cine: "cinema",
  mundo: "world-news",
};

export const URL_TO_DB_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(DB_SLUG_TO_URL).map(([db, url]) => [url, db]),
);

export const URL_SLUG_LABELS: Record<string, string> = {
  sports: "Deportes",
  technology: "Tecnología",
  "video-games": "Videojuegos",
  cinema: "Cine",
  "world-news": "Mundo",
};

export function categoryUrlPath(dbSlug: string): string {
  return `/categoria/${DB_SLUG_TO_URL[dbSlug] ?? dbSlug}`;
}
