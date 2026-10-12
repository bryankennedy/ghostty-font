// INFRA-161: AGENTS.md is the one instruction file and CLAUDE.md only imports
// it. The review runs under --restricted, which loads no project memory, so
// the reviewer finds the criteria by reading the file the prompt names.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("CLAUDE.md is exactly the @AGENTS.md pointer", () => {
  expect(read("CLAUDE.md")).toBe("@AGENTS.md\n");
});

test("AGENTS.md carries the review criteria the prompt sends the reviewer to", () => {
  expect(read("AGENTS.md")).toMatch(/^## Code review criteria$/m);
  expect(read(".forgejo/review/prompt.md")).toMatch(/`\.\/AGENTS\.md` holds\s+the review criteria/);
});
