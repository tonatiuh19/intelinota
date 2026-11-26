/**
 * Lightweight comment risk scoring (0–100) with human-readable flags.
 * Pure function: no DB access, so it is unit-testable; callers pass history.
 */
export type CommentFlag =
  | "links"
  | "blocked_word"
  | "shouting"
  | "repeated_chars"
  | "duplicate"
  | "burst"
  | "known_spammer"
  | "too_short"
  | "trusted";

export interface ModerationInput {
  content: string;
  authorName: string;
  authorEmail: string | null;
  blocklist: string[];
  /** Same IP/email posted identical text in the last 24 h */
  duplicateCount: number;
  /** Comments from the same IP in the last 10 min */
  recentFromIp: number;
  /** Prior moderation outcomes for this email */
  approvedBefore: number;
  spamBefore: number;
}

export interface ModerationResult {
  score: number;
  flags: CommentFlag[];
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function scoreComment(i: ModerationInput): ModerationResult {
  const flags = new Set<CommentFlag>();
  let score = 0;
  const text = i.content.trim();
  const plain = norm(`${i.authorName} ${text}`);

  const links = (text.match(/https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|xyz|ru|top|info|io)\b/gi) ?? []).length;
  if (links > 0) {
    flags.add("links");
    score += Math.min(45, 20 + links * 10);
  }

  const hit = i.blocklist
    .map((w) => norm(w.trim()))
    .filter((w) => w.length >= 3)
    .find((w) => new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(plain));
  if (hit) {
    flags.add("blocked_word");
    score += 50;
  }

  const letters = text.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "");
  if (letters.length >= 20 && letters.replace(/[^A-ZÁÉÍÓÚÑ]/g, "").length / letters.length > 0.7) {
    flags.add("shouting");
    score += 15;
  }
  if (/(.)\1{6,}/u.test(text)) {
    flags.add("repeated_chars");
    score += 10;
  }
  if (i.duplicateCount > 0) {
    flags.add("duplicate");
    score += 35;
  }
  if (i.recentFromIp >= 3) {
    flags.add("burst");
    score += 20;
  }
  if (i.spamBefore > 0) {
    flags.add("known_spammer");
    score += Math.min(50, 25 * i.spamBefore);
  }
  if (text.length < 8) {
    flags.add("too_short");
    score += 5;
  }
  if (i.approvedBefore >= 2 && i.spamBefore === 0) {
    flags.add("trusted");
    score -= 30;
  }

  return { score: Math.max(0, Math.min(100, score)), flags: Array.from(flags) };
}
