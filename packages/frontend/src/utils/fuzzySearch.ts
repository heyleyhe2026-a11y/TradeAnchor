/** Normalize text for case-insensitive search. */
export function normalizeSearchText(text: string): string {
  return text.toLowerCase().trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const row = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return row[n];
}

/** Score 0–1 for how well `query` matches `target` (higher is better). */
export function fuzzyMatchScore(query: string, target: string): number {
  const q = normalizeSearchText(query);
  const t = normalizeSearchText(target);
  if (!q) return 1;
  if (!t) return 0;

  if (t.includes(q)) {
    if (t.startsWith(q)) return 1;
    const wordStart = new RegExp(`(?:^|[\\s,/\\-])${escapeRegExp(q)}`).test(t);
    return wordStart ? 0.98 : 0.92;
  }

  let qi = 0;
  let consecutive = 0;
  let maxConsecutive = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) {
      qi++;
      consecutive++;
      maxConsecutive = Math.max(maxConsecutive, consecutive);
    } else {
      consecutive = 0;
    }
  }
  if (qi === q.length) {
    return 0.55 + (maxConsecutive / q.length) * 0.25 + Math.min(q.length / t.length, 1) * 0.15;
  }

  const window = t.slice(0, Math.min(t.length, q.length + 8));
  const dist = levenshtein(q, window);
  const ratio = 1 - dist / Math.max(q.length, window.length);
  if (ratio >= 0.65) return ratio * 0.55;

  return 0;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Score an item against a query using multiple searchable fields. */
export function scoreAgainstFields(query: string, fields: string[]): number {
  const trimmed = query.trim();
  if (!trimmed) return 1;

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) {
    return Math.max(0, ...fields.map((field) => fuzzyMatchScore(trimmed, field)));
  }

  const tokenScores = tokens.map((token) =>
    Math.max(0, ...fields.map((field) => fuzzyMatchScore(token, field))),
  );
  const minToken = Math.min(...tokenScores);
  const avgToken = tokenScores.reduce((sum, score) => sum + score, 0) / tokenScores.length;
  const fullPhrase = Math.max(0, ...fields.map((field) => fuzzyMatchScore(trimmed, field)));

  return Math.max(fullPhrase, minToken * 0.65 + avgToken * 0.35);
}
