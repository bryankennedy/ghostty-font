import { describe, expect, test } from "bun:test";
import { clip, clipStyled, paint, visible } from "../src/text.js";

describe("clip", () => {
  test("leaves text that fits alone", () => {
    expect(clip("Fira Code", 9)).toBe("Fira Code");
  });

  test("cuts to the width, ellipsis included", () => {
    expect(clip("IBM Plex Mono", 8)).toBe("IBM Ple…");
  });
});

describe("clipStyled", () => {
  const red = (s) => `\x1b[31m${s}\x1b[39m`;

  test("leaves styled text that fits alone", () => {
    const s = `a ${red("bc")} d`;
    expect(clipStyled(s, 6)).toBe(s);
  });

  test("counts only visible characters", () => {
    const out = clipStyled(`${red("abcdef")}ghij`, 6);
    expect(visible(out)).toBe(6);
    expect(out.replace(/\x1b\[[0-9;]*m/g, "")).toBe("abcde…");
  });

  test("resets style at the cut so color can't bleed", () => {
    expect(clipStyled(red("abcdefghij"), 5)).toBe("\x1b[31mabcd\x1b[0m…");
  });
});

describe("paint", () => {
  test("colors each marked span and resets after it", () => {
    expect(paint("«k:const» x «s:\"y\"»")).toBe('\x1b[35mconst\x1b[0m x \x1b[32m"y"\x1b[0m');
  });

  test("leaves unmarked text untouched", () => {
    expect(paint("plain => text")).toBe("plain => text");
  });
});
