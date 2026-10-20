# AGENTS.md

`ghostty-font`: a bun CLI (`bin/ghostty-font`, macOS only) that tries monospace
fonts in Ghostty live, compares two side by side and ranks them with Elo
(`src/ranking.js`). It never edits the Ghostty config: it writes an override,
`~/.config/ghostty/font.ghostty`, and asks Ghostty to reload through
`osascript`. Duels live in `~/.local/state/ghostty-font/duels.json`. No
dependencies, only Node built-ins. `bun test` is the CI suite. PRs are reviewed
on the forge at `https://git.bck.dev`; GitHub is a push mirror, and the
dotfiles flake installs the tool on the owner's Mac from a pinned commit of it.
Fleet policy lives in infrastructure's [docs/house-standards.md](https://git.bck.dev/bkennedy/infrastructure/src/branch/main/docs/house-standards.md);
it is linked here, not restated.

## Code review criteria

Read on every automated PR review. Report only problems the PR introduces.

### Blast radius

`.forgejo/CODEOWNERS` puts every path behind the owner's approval, so "high"
here does not decide who signs off. It marks the changes where a mistake writes
to the user's files, runs a command, or changes how this review works.

**High: say so at the top of the review.**

- Writing and restoring the user's files, in `bin/ghostty-font`:
  `writeOverride`, `restore`, `finish`, the signal, stdin-end and `exit`
  handlers in `pick`, `reset`, `rank reset`, and the path constants (`CONFIG`,
  `OVERRIDE`, `DUELS`, `GHOSTTY`).
- The duel log's format and I/O: `loadBook` and `saveBook` in `src/ranking.js`,
  and anything that changes the book's shape (`{ duels: [{ a, b, score, at }],
  dropped }`) or the font names it is keyed by.
- Spawning processes: `run`, `spawn`, `familyLines` and `RELOAD_SCRIPT`.
- `package.json` fields that change what `bun install -g` puts on the machine:
  `bin`, `files`, `private`, `dependencies`, any lifecycle script.
- The review and CI setup itself: `.forgejo/` (including
  `.forgejo/workflows/test.yml`, whose `test / *` is the required check on
  `main`), `scripts/forgejo-review.mjs`, and this file.

**Low:** `README.md`, `src/text.js`, and the display-only strings in
`bin/ghostty-font` (`PREVIEW`, the key-help lines, status text).

Everything else is standard.

### Flag hard

- A write to the Ghostty `config` itself, or to any path other than
  `font.ghostty` and the duel log (plus its `.bak`). The tool only reads the
  config.
- Override text built from a name that was not resolved against `families()`,
  or a family written without its quotes or with a `"` or newline let through.
  The override is Ghostty config: a smuggled line such as `command = …` runs a
  program when Ghostty next starts.
- A shell: `shell: true`, `exec` with a command string, or a font name or user
  text interpolated into the AppleScript or any command line. Arguments go as
  arrays; `RELOAD_SCRIPT` is a constant.
- A way out of the interactive list (key, `SIGTERM`/`SIGHUP`, stdin closing,
  `exit`, an exception) that leaves a trial font in place without Enter, or a
  `restore` that stops putting back exactly the `before` snapshot (deleting an
  override that existed, or keeping one that did not).
- Losing duels: `loadBook` reading a corrupt file as an empty book (the next
  `saveBook` then overwrites it), `rank reset` deleting instead of moving to
  `duels.json.bak`, a changed default path or book shape with no migration, or
  the "corrupt file throws" test removed or loosened.
- Network access, a new dependency, or a lifecycle script (`preinstall`,
  `postinstall`, `prepare`): the owner's Mac installs this package unattended
  on `darwin-rebuild switch`.
- Install instructions that pin a tag or branch instead of a commit, or a
  change that asks for an existing tag to be moved: the dotfiles flake pins the
  commit `v0.1.1` names, and its pin audit compares against that tag.
- CI: the `test` workflow or job renamed (it is the required check), an action
  pinned to a tag instead of a commit, `persist-credentials: false` dropped, or
  the bun download losing its literal `BUN_SHA256`.
- Weakening the review's own sandbox: `claude-review.yml` triggering on
  `pull_request`, a checkout that keeps credentials, a secret reaching a step
  that reads `pr/`, or the Claude step losing `--restricted` or `env -i`.
- The runner cache beyond the six steps "Deliberate: do not flag" accepts
  (INFRA-203, INFRA-207):
  - a change that breaks one of the four conditions listed there, such as
    `restore-keys` or a key not derived from `hashFiles`;
  - a cache step, `path` or `key` added to or changed in a job that holds a
    secret (a `secrets.*` value, or `github.token` passed to a step
    explicitly). Today that is only `claude-review.yml`'s `review` job, which
    holds `CLAUDE_CODE_OAUTH_TOKEN`, `CLAUDE_REVIEW_TOKEN` and `github.token`.
    Flag it even when it meets the conditions: the fleet rule can allow it,
    but the owner confirms each change to a secret-holding job. A change that
    only moves the `actions/cache` pin to another commit does not count;
  - a step outside the `review` job that restores or saves a key the `review`
    job uses (`review-tools-…`, `ci-downloads-review-…`);
  - a restored file unpacked, executed, installed or put on `PATH` before it
    passes a check against a literal digest in `.forgejo/ci/install-tools.sh`
    (`CLAUDE_TGZ_SHA256`, `CLAUDE_BIN_SHA256`, `BUN_SHA256`);
  - a cache save that can run on `pull_request`, such as `test.yml`'s save
    losing its `github.event_name != 'pull_request'` condition.

### Deliberate: do not flag

- The six `actions/cache` steps this repository has, each keyed exactly on
  `hashFiles('.forgejo/ci/install-tools.sh')` with no `restore-keys`:
  - four in `claude-review.yml`'s `review` job, which holds secrets: a restore
    and a save of `review-tools-…` (`/usr/local/lib/claude-code`), and a
    restore and a save of `ci-downloads-review-…` (`/root/.cache/ci-downloads`);
  - two in `test.yml`, which holds no secret: a restore of
    `ci-downloads-bun-…`, and its save, which runs only when
    `github.event_name != 'pull_request'`.

  The owner accepted these under the fleet rule (`bkennedy/infrastructure`,
  `docs/house-standards.md` section 7, INFRA-203), which this review cannot
  read. Its conditions, as they apply here:
  1. `claude-review.yml` triggers on `pull_request_target`, never
     `pull_request`;
  2. every cache key is exact and derived from `hashFiles(...)`, with no
     `restore-keys`;
  3. no workflow here runs code or text from an account without write access
     (the PR's code, or a PR title, branch name, label or comment interpolated
     into a `run:` step) on an event other than `pull_request`. `push` and
     `workflow_dispatch`, which only a writer can start, are fine;
  4. the forge's runner isolates cache entries written by `pull_request` runs,
     so the `review` job cannot restore one (measured 2026-10-03). This is a
     runner property that nothing in this repository shows; it is checked in
     `bkennedy/infrastructure` when the runner changes, not here.

  The digest checks in `install-tools.sh` catch a corrupt entry but do not
  contain a forged one, since a restore can write anywhere in the job
  container; condition 4 is the barrier. A cache step added to, changed in or
  removed from a job that holds no secret is not a finding while it keeps
  conditions 2 and 3, saves nothing on `pull_request`, and stays off the
  `review` job's keys. Only the cache cases listed under "Flag hard" are
  findings.
- macOS only: `"os": ["darwin"]`, the `/Applications/Ghostty.app` default
  (`GHOSTTY_BIN` overrides it), and reloading through `osascript`.
- The built-in picker instead of fzf (fzf's synchronous focus hook queued one
  reload per row), and no dependencies at all.
- `"private": true` with nothing that publishes; `package.json` at `0.1.1`
  while the `v0.1.1` tag stays on `733bfdb`, whose tree reads `0.1.0` (the tag
  is not moved because the dotfiles flake pins that commit).
- `github.com/bryankennedy/ghostty-font` URLs in `README.md`: GitHub is the
  push mirror the flake installs from.
- The CI's bun download from a GitHub release URL: it is checked against a
  literal digest.
- `reset` and a return to the config's own font deleting `font.ghostty`: the
  override is the tool's own file.
