# CLAUDE.md

`ghostty-font`: a bun CLI (`bin/ghostty-font`, macOS only) that tries monospace
fonts in Ghostty live, compares two side by side and ranks them with Elo
(`src/ranking.js`). It never edits the Ghostty config: it writes an override,
`~/.config/ghostty/font.ghostty`, and asks Ghostty to reload through
`osascript`. Duels live in `~/.local/state/ghostty-font/duels.json`. No
dependencies, only Node built-ins. `bun test` is the CI suite. PRs are reviewed
on the forge at `https://git.bck.dev`; GitHub is a push mirror, and the
dotfiles flake installs the tool on the owner's Mac from a pinned commit of it.

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

### Deliberate: do not flag

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
