/** Lower-cased word tokens (letters/digits incl. accents). */
export function tokenizeWords(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []);
}

export interface WordDiffSummary {
  added: number;
  removed: number;
  before: number;
  after: number;
}

/**
 * Bag-of-words diff: how many words were added / removed between two texts.
 * Order-insensitive on purpose — linear time even for long articles, and a
 * reviewer only needs the size of the change, not an alignment.
 */
export function wordDiffSummary(before: string, after: string): WordDiffSummary {
  const a = tokenizeWords(before);
  const b = tokenizeWords(after);
  const counts = new Map<string, number>();
  for (const w of a) counts.set(w, (counts.get(w) ?? 0) + 1);
  for (const w of b) counts.set(w, (counts.get(w) ?? 0) - 1);
  let added = 0;
  let removed = 0;
  for (const delta of counts.values()) {
    if (delta > 0) removed += delta;
    else if (delta < 0) added -= delta;
  }
  return { added, removed, before: a.length, after: b.length };
}
