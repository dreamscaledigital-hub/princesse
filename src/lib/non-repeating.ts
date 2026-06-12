const STORAGE_PREFIX = "princesse:non-repeating:v1:";
const DEFAULT_LIMIT = 80;

function canStore(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function normalizeRepeatKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getRecentHistory(scope: string, limit = DEFAULT_LIMIT): string[] {
  if (!canStore()) return [];
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${scope}`);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string").slice(-limit) : [];
  } catch {
    return [];
  }
}

export function markItemsUsed<T>(scope: string, items: T[], getKey: (item: T) => string, limit = DEFAULT_LIMIT): void {
  if (!canStore() || items.length === 0) return;
  const next = [...getRecentHistory(scope, limit), ...items.map((item) => normalizeRepeatKey(getKey(item))).filter(Boolean)];
  const deduped = next.filter((key, index) => next.lastIndexOf(key) === index).slice(-limit);
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${scope}`, JSON.stringify(deduped));
  } catch {
    // stockage plein ou indisponible : on laisse juste le tirage aléatoire fonctionner
  }
}

export function filterFreshItems<T>(items: T[], scope: string, getKey: (item: T) => string): T[] {
  const used = new Set(getRecentHistory(scope));
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeRepeatKey(getKey(item));
    if (!key || used.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function nonRepeatingSample<T>(items: T[], count: number, scope: string, getKey: (item: T) => string): T[] {
  const fresh = shuffle(filterFreshItems(items, scope, getKey));
  if (fresh.length >= count) return fresh.slice(0, count);

  const freshKeys = new Set(fresh.map((item) => normalizeRepeatKey(getKey(item))));
  const recycled = shuffle(items.filter((item) => !freshKeys.has(normalizeRepeatKey(getKey(item)))));
  return [...fresh, ...recycled].slice(0, count);
}

export function pickNonRepeating<T>(items: T[], scope: string, getKey: (item: T) => string): T | null {
  return nonRepeatingSample(items, 1, scope, getKey)[0] ?? null;
}