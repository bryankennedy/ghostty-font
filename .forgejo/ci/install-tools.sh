#!/bin/sh
# The pinned toolchain the Claude PR review job needs
# (.forgejo/workflows/claude-review.yml), installed into a node:22-trixie
# job container (root, Debian 13).
#
# The review path of this file is synced verbatim from
# bkennedy/infrastructure by scripts/forgejo-review-sync.mjs: bump a pin
# there, not here. Anything this repository adds for its own CI (a `test`
# path, say) belongs to this repository and the sync leaves it alone.
#
# Every downloaded binary is checked against a LITERAL digest: a checksum
# fetched from the same release as the artefact is not an independent
# check. Claude Code comes from npm pinned by version, not by hash:
# hash-pinning would mean pinning every transitive dependency too.
set -eu

BUN_VERSION=1.3.13
BUN_SHA256=79c0771fa8b92c33aae41e15a0e0d307ea99d0e2f00317c71c6c53237a78e25a
CLAUDE_CODE_VERSION=2.1.267

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# fetch <url> <sha256> <dest> — the only way this script downloads anything.
fetch() {
  curl -fsSL --retry 3 -o "$3" "$1"
  echo "$2  $3" | sha256sum -c --quiet -
}

apt_install() {
  DEBIAN_FRONTEND=noninteractive apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends "$@" >/dev/null
}

install_bun() {
  fetch "https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/bun-linux-x64.zip" \
    "$BUN_SHA256" "$tmp/bun.zip"
  unzip -q -o "$tmp/bun.zip" -d "$tmp"
  install -m 0755 "$tmp/bun-linux-x64/bun" /usr/local/bin/bun
  bun --version
}

# npm, not bun: the package's postinstall picks the platform's native
# binary, and bun does not run lifecycle scripts for dependencies it has
# not been told to trust.
install_claude() {
  npm install --global --no-fund --no-audit --loglevel=error "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}"
  claude --version
}

case "${1:-}" in
  review)
    apt_install unzip
    install_bun
    install_claude
    ;;
  *)
    echo "usage: $0 review" >&2
    exit 2
    ;;
esac
