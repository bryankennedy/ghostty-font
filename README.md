# ghostty-font

Try monospace fonts in [Ghostty](https://ghostty.org) live, compare two side by
side, and let an Elo ranking tell you which one you actually prefer.

Every change shows up in every open Ghostty window within a second, and
nothing touches your real config: the tool writes a small override file that
your config includes, and deleting it puts your own font back.

Lives at [git.bck.dev/bkennedy/ghostty-font](https://git.bck.dev/bkennedy/ghostty-font);
[github.com/bryankennedy/ghostty-font](https://github.com/bryankennedy/ghostty-font)
is a read-only push mirror of it.

## Requirements

- macOS, with Ghostty in `/Applications` (or `GHOSTTY_BIN` pointing at its binary).
  Reloading goes through Ghostty's AppleScript support (Ghostty 1.3+).
- [Bun](https://bun.sh) 1.3 or newer.
- One line in your Ghostty config (`~/.config/ghostty/config`), anywhere in the
  file — it loads the override when it exists and is ignored when it doesn't:

  ```
  config-file = ?font.ghostty
  ```

- Some fonts to try. With Homebrew, for example:

  ```sh
  brew install --cask font-fira-code font-hack font-ibm-plex-mono font-iosevka \
    font-jetbrains-mono font-victor-mono font-monaspace font-geist-mono
  ```

## Install

Pin a commit, not a tag, so what runs can't change underneath you:

```sh
bun install -g github:bryankennedy/ghostty-font#<commit sha>
```

## Use

```sh
ghostty-font                  # the interactive list
ghostty-font plex             # the list, filtered to fonts containing "plex"
ghostty-font rank             # random duels that build a ranking
ghostty-font compare fira hack
ghostty-font set iosevka 14   # any unique part of a name, optional size
ghostty-font next | prev
ghostty-font list [search]    # ranked by rating once there are duels
ghostty-font reset            # back to your config's font
```

### The list

Moving the cursor applies each font after it rests for a moment, with a sample
of text and syntax-colored code below the list.

| Key | Does |
|---|---|
| type | filter by substring |
| ↑ ↓ Tab | move (wraps) |
| → | mark as A; → on a second font marks B and opens compare |
| ← | clear the mark |
| Ctrl-R | start ranking |
| Enter | keep the highlighted font |
| Esc | put back the font you started with |

### Compare

Just the two marked fonts. Space, Tab or ↑↓ flip between them; ← or `a` shows
A, → or `b` shows B. Enter keeps the one on screen. Esc returns to the list
with that font still marked as A, so the next → sets up its challenger.

### Rank

The tool picks the pair; you press Enter on the one you'd rather read. Ratings
and records are hidden during a duel so they can't sway the pick, but the
status line tells you your favorite so far.

| Key | Does |
|---|---|
| Space ↑↓ Tab | flip between A and B |
| ← `a` / → `b` | show A / B |
| Enter | the font on screen wins |
| `=` | tie |
| `s` | skip this pair |
| `x` | drop the font on screen from ranking for good |
| `u` | undo the last result and replay that pair |
| Esc | the ranked list, cursor on your favorite |

**How it ranks.** Every font starts at 1500 and each duel moves the two ratings
by up to 32 points (standard Elo), more for an upset. Pairs aren't uniformly
random: until every font has three duels, one side is always a least-played
font; after that one side comes from the top third, matched against a close
rating. That spends your duels on the question you care about — which font is
first. In simulation (31 fonts, picks that agree with a hidden order 90% of the
time) the true favorite was ranked first after 90 duels 60% of the time, and
after 180 duels 83%. Dropping fonts you clearly dislike gets there sooner.

## Files

| Path | What |
|---|---|
| `~/.config/ghostty/font.ghostty` | the override; deleted by `reset` |
| `~/.local/state/ghostty-font/duels.json` | every duel and drop; ratings are replayed from it (`XDG_STATE_HOME` is honored) |

`ghostty-font rank reset` moves the duel log to `duels.json.bak` and starts over.

## Develop

```sh
bun test
```
