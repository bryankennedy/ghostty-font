import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CALIBRATION, K, START_RATING, loadBook, nextPair, ratingsFrom, saveBook, standings } from "../src/ranking.js";

// A seeded generator so pair selection is reproducible.
const seeded = (seed) => () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);

const fonts = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot"];

describe("ratingsFrom", () => {
  test("a win between equal ratings moves each side by K/2", () => {
    const t = ratingsFrom([{ a: "Alpha", b: "Bravo", score: 1 }]);
    expect(t.get("Alpha").rating).toBe(START_RATING + K / 2);
    expect(t.get("Bravo").rating).toBe(START_RATING - K / 2);
    expect(t.get("Alpha")).toMatchObject({ games: 1, wins: 1, losses: 0 });
    expect(t.get("Bravo")).toMatchObject({ games: 1, wins: 0, losses: 1 });
  });

  test("a tie between equal ratings changes nothing but the game count", () => {
    const t = ratingsFrom([{ a: "Alpha", b: "Bravo", score: 0.5 }]);
    expect(t.get("Alpha")).toMatchObject({ rating: START_RATING, games: 1, wins: 0, losses: 0 });
  });

  test("beating a stronger font is worth more than beating a weaker one", () => {
    const setup = [
      { a: "Alpha", b: "Charlie", score: 1 },
      { a: "Alpha", b: "Delta", score: 1 },
    ];
    const upset = ratingsFrom([...setup, { a: "Bravo", b: "Alpha", score: 1 }]);
    const expected = ratingsFrom([...setup, { a: "Alpha", b: "Bravo", score: 1 }]);
    const upsetGain = upset.get("Bravo").rating - START_RATING;
    const favoriteGain = expected.get("Alpha").rating - ratingsFrom(setup).get("Alpha").rating;
    expect(upsetGain).toBeGreaterThan(favoriteGain);
  });

  test("ratings are zero-sum", () => {
    const duels = [
      { a: "Alpha", b: "Bravo", score: 1 },
      { a: "Bravo", b: "Charlie", score: 0.5 },
      { a: "Charlie", b: "Alpha", score: 1 },
    ];
    const total = [...ratingsFrom(duels).values()].reduce((sum, r) => sum + r.rating, 0);
    expect(total).toBeCloseTo(3 * START_RATING, 9);
  });
});

describe("standings", () => {
  test("rated fonts best-first with ranks, then unrated, then dropped", () => {
    const book = {
      duels: [
        { a: "Charlie", b: "Alpha", score: 1 },
        { a: "Charlie", b: "Echo", score: 1 },
      ],
      dropped: ["Bravo", "Echo"],
    };
    const rows = standings(fonts, book);
    expect(rows.map((r) => r.name)).toEqual(["Charlie", "Alpha", "Delta", "Foxtrot", "Bravo", "Echo"]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, null, null, null, null]);
    expect(rows.find((r) => r.name === "Echo")).toMatchObject({ dropped: true, games: 1 });
  });
});

describe("nextPair", () => {
  const info = (duels) => new Map(standings(fonts, { duels, dropped: [] }).map((r) => [r.name, r]));

  test("returns two different fonts from the pool", () => {
    const random = seeded(1);
    for (let i = 0; i < 200; i++) {
      const [a, b] = nextPair(fonts, info([]), null, random);
      expect(fonts).toContain(a);
      expect(fonts).toContain(b);
      expect(a).not.toBe(b);
    }
  });

  test("while calibrating, one side is always a least-played font", () => {
    const duels = [
      { a: "Alpha", b: "Bravo", score: 1 },
      { a: "Charlie", b: "Delta", score: 1 },
    ];
    const random = seeded(7);
    for (let i = 0; i < 100; i++) {
      const pair = nextPair(fonts, info(duels), null, random);
      expect(pair.some((f) => f === "Echo" || f === "Foxtrot")).toBe(true);
    }
  });

  test("never repeats the pair just played when another exists", () => {
    const random = seeded(3);
    let last = null;
    for (let i = 0; i < 300; i++) {
      const pair = nextPair(fonts, info([]), last, random);
      if (last) expect([...pair].sort()).not.toEqual([...last].sort());
      last = pair;
    }
  });

  test("with two fonts the only pair is allowed to repeat", () => {
    expect([...nextPair(["Alpha", "Bravo"], new Map(), ["Alpha", "Bravo"])].sort()).toEqual(["Alpha", "Bravo"]);
  });

  test("once calibrated, one side is a top-rated contender", () => {
    // Everyone past calibration; Alpha and Bravo clearly lead.
    const duels = [];
    for (let round = 0; round < CALIBRATION + 1; round++) {
      for (const loser of ["Charlie", "Delta", "Echo", "Foxtrot"]) {
        duels.push({ a: round % 2 ? "Alpha" : "Bravo", b: loser, score: 1 });
      }
    }
    const table = info(duels);
    const top = [...fonts].sort((x, y) => table.get(y).rating - table.get(x).rating).slice(0, 4);
    const random = seeded(11);
    for (let i = 0; i < 100; i++) {
      expect(nextPair(fonts, table, null, random).some((f) => top.includes(f))).toBe(true);
    }
  });

  test("refuses a pool too small to pair", () => {
    expect(() => nextPair(["Alpha"], new Map(), null)).toThrow();
  });
});

describe("book file", () => {
  const dir = mkdtempSync(join(tmpdir(), "ghostty-font-"));

  test("a missing file is an empty book", () => {
    expect(loadBook(join(dir, "missing.json"))).toEqual({ duels: [], dropped: [] });
  });

  test("round-trips through save and load, creating the directory", () => {
    const path = join(dir, "nested/duels.json");
    const book = { duels: [{ a: "Alpha", b: "Bravo", score: 1, at: "2026-09-11T00:00:00.000Z" }], dropped: ["Echo"] };
    saveBook(path, book);
    expect(loadBook(path)).toEqual(book);
    expect(readFileSync(path, "utf8").endsWith("\n")).toBe(true);
  });

  test("a corrupt file throws instead of reading as empty", () => {
    const path = join(dir, "corrupt.json");
    writeFileSync(path, "{bad");
    expect(() => loadBook(path)).toThrow(/Fix or move it aside/);
  });
});
