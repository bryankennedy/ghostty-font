// Terminal text helpers: width-aware clipping and the sample's syntax colors.

const STYLE = /\x1b\[[0-9;]*m/g;

// Visible width, ignoring color and style escapes.
export const visible = (s) => s.replace(STYLE, "").length;

export const clip = (s, width) => (s.length > width ? s.slice(0, Math.max(width - 1, 0)) + "…" : s);

// clip() for styled text: count only visible characters, keep the escapes, and
// reset at the cut so a color can't bleed into the next line.
export function clipStyled(s, width) {
  if (visible(s) <= width) return s;
  let kept = "";
  let room = Math.max(width - 1, 0);
  for (const part of s.split(/(\x1b\[[0-9;]*m)/)) {
    if (part.startsWith("\x1b[")) kept += part;
    else if (part.length <= room) ((kept += part), (room -= part.length));
    else {
      kept += part.slice(0, room);
      break;
    }
  }
  return `${kept}\x1b[0m…`;
}

// Syntax colors, written «kind:text». They are ANSI palette slots rather than
// RGB so they come out in the Ghostty theme's own colors — the same colors real
// highlighted code will be read in.
export const SYNTAX = {
  k: "35", // keyword
  t: "33", // type
  f: "34", // function
  s: "32", // string
  n: "91", // number, constant
  o: "36", // operator
  d: "95", // decorator
  c: "3;90", // comment: italic and muted, where fonts differ most
};

// Without color (NO_COLOR, https://no-color.org), comments keep their italics:
// italic shapes are a style, not a color, and they are part of what you compare.
const PLAIN = { c: "3" };

export const paint = (line, color = true) =>
  line.replace(/«(\w):(.*?)»/g, (_, kind, text) => {
    const sgr = color ? SYNTAX[kind] : PLAIN[kind];
    return sgr ? `\x1b[${sgr}m${text}\x1b[0m` : text;
  });

// NO_COLOR turns color off when it is set to any value but the empty string.
export const colorWanted = (env) => !env.NO_COLOR;
