// Elo ranking from a log of duels.
//
// Every duel is appended to the book and ratings are replayed from that log, so
// undo is just dropping the last entry and K can change without losing history.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

// Every font starts at START_RATING; K is the most one duel can move a rating.
export const START_RATING = 1500;
export const K = 32;
// Duels every font gets before pairing starts to concentrate on the top.
export const CALIBRATION = 3;

// The book: { duels: [{ a, b, score, at }], dropped: [font] }. score is A's
// result — 1 win, 0 loss, 0.5 tie. A corrupt file throws rather than being
// silently replaced by an empty book on the next save.
export function loadBook(path) {
  if (!existsSync(path)) return { duels: [], dropped: [] };
  let book;
  try {
    book = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new Error(`Can't read ${path} (${err.message}). Fix or move it aside.`);
  }
  return { duels: book.duels ?? [], dropped: book.dropped ?? [] };
}

export function saveBook(path, book) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(book, null, 2) + "\n");
}

// Replay the duel log into ratings.
export function ratingsFrom(duels) {
  const table = new Map();
  const entry = (name) => {
    if (!table.has(name)) table.set(name, { rating: START_RATING, games: 0, wins: 0, losses: 0 });
    return table.get(name);
  };
  for (const { a, b, score } of duels) {
    const A = entry(a);
    const B = entry(b);
    const expected = 1 / (1 + 10 ** ((B.rating - A.rating) / 400));
    const delta = K * (score - expected);
    A.rating += delta;
    B.rating -= delta;
    A.games++;
    B.games++;
    if (score === 1) (A.wins++, B.losses++);
    if (score === 0) (B.wins++, A.losses++);
  }
  return table;
}

// Installed fonts in ranked order: rated best-first, then unrated, then dropped
// (both in the order given). Only rated, undropped fonts get a rank number.
export function standings(fonts, book) {
  const table = ratingsFrom(book.duels);
  const dropped = new Set(book.dropped);
  const rows = fonts.map((name) => ({
    name,
    rating: START_RATING,
    games: 0,
    wins: 0,
    losses: 0,
    ...table.get(name),
    dropped: dropped.has(name),
    rank: null,
  }));
  const rated = rows.filter((r) => r.games && !r.dropped).sort((x, y) => y.rating - x.rating);
  rated.forEach((r, i) => (r.rank = i + 1));
  return [...rated, ...rows.filter((r) => !r.games && !r.dropped), ...rows.filter((r) => r.dropped)];
}

const oneOf = (list, random) => list[Math.floor(random() * list.length)];

// Until every font has CALIBRATION duels, one side is a least-played font, so
// nothing stays unrated. After that one side comes from the top third: the
// question is the favorite, and #1 vs #2 matters more than #20 vs #21. The other
// side leans toward a close rating and few duels, with jitter so the same
// matchups don't keep coming back. Never the pair just played; sides shuffled.
//
// In a simulation of 31 fonts and a chooser who agrees with a hidden order 90%
// of the time, this ranked the true favorite first after 90 duels in 60% of
// runs, against 39% for always pairing the least-played fonts.
export function nextPair(pool, info, last, random = Math.random) {
  if (pool.length < 2) throw new Error("nextPair needs at least two fonts");
  const games = (f) => info.get(f)?.games ?? 0;
  const rating = (f) => info.get(f)?.rating ?? START_RATING;
  const fewest = Math.min(...pool.map(games));
  const contenders = [...pool]
    .sort((x, y) => rating(y) - rating(x))
    .slice(0, Math.max(4, Math.ceil(pool.length / 3)));
  const a = oneOf(fewest < CALIBRATION ? pool.filter((f) => games(f) === fewest) : contenders, random);
  const rematch = (f) => last?.includes(a) && last?.includes(f);
  const others = pool.filter((f) => f !== a && !rematch(f));
  const candidates = (others.length ? others : pool.filter((f) => f !== a))
    .map((f) => ({ f, score: Math.abs(rating(a) - rating(f)) + 15 * games(f) + random() * 60 }))
    .sort((x, y) => x.score - y.score);
  const b = oneOf(candidates.slice(0, 3), random).f;
  return random() < 0.5 ? [a, b] : [b, a];
}
