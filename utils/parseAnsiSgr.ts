import type { TextStyle } from "react-native";

export type AnsiTextRun = {
  text: string;
  style: Pick<TextStyle, "color" | "fontWeight" | "fontStyle" | "textDecorationLine">;
};

type AnsiState = {
  fg?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

function clampByte(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(255, Math.round(n)));
}

function rgbToHex(r: number, g: number, b: number): string {
  const rr = clampByte(r).toString(16).padStart(2, "0");
  const gg = clampByte(g).toString(16).padStart(2, "0");
  const bb = clampByte(b).toString(16).padStart(2, "0");
  return `#${rr}${gg}${bb}`;
}

// Standard ANSI 16-color palette (rough iTerm-ish, not perfect but readable).
const ANSI_16: string[] = [
  "#000000", // 0 black
  "#cc0000", // 1 red
  "#4e9a06", // 2 green
  "#c4a000", // 3 yellow
  "#3465a4", // 4 blue
  "#75507b", // 5 magenta
  "#06989a", // 6 cyan
  "#d3d7cf", // 7 white (light gray)
  "#555753", // 8 bright black (dark gray)
  "#ef2929", // 9 bright red
  "#8ae234", // 10 bright green
  "#fce94f", // 11 bright yellow
  "#729fcf", // 12 bright blue
  "#ad7fa8", // 13 bright magenta
  "#34e2e2", // 14 bright cyan
  "#eeeeec", // 15 bright white
];

function xterm256ToHex(code: number): string | undefined {
  if (!Number.isFinite(code)) return undefined;
  const c = Math.trunc(code);
  if (c < 0 || c > 255) return undefined;
  if (c < 16) return ANSI_16[c];

  // 16..231: 6×6×6 color cube
  if (c >= 16 && c <= 231) {
    const idx = c - 16;
    const r = Math.floor(idx / 36);
    const g = Math.floor((idx % 36) / 6);
    const b = idx % 6;
    const steps = [0, 95, 135, 175, 215, 255];
    return rgbToHex(steps[r], steps[g], steps[b]);
  }

  // 232..255: grayscale ramp
  const gray = 8 + (c - 232) * 10;
  return rgbToHex(gray, gray, gray);
}

function stateToStyle(state: AnsiState, baseColor: string): AnsiTextRun["style"] {
  return {
    color: state.fg ?? baseColor,
    fontWeight: state.bold ? ("700" as const) : ("400" as const),
    fontStyle: state.italic ? ("italic" as const) : ("normal" as const),
    textDecorationLine: state.underline ? ("underline" as const) : ("none" as const),
  };
}

/**
 * Parse ANSI SGR (Select Graphic Rendition) sequences and return styled runs.
 *
 * Supports:
 * - reset: 0
 * - bold: 1 / 22
 * - italic: 3 / 23
 * - underline: 4 / 24
 * - 16-color fg: 30-37, 90-97, reset 39
 * - 256-color fg: 38;5;n
 * - truecolor fg: 38;2;r;g;b
 *
 * Notes:
 * - We intentionally ignore background colors for now.
 * - Unknown sequences are ignored (and not emitted as text).
 */
export function parseAnsiSgrToRuns(input: string, baseColor: string): AnsiTextRun[] {
  const runs: AnsiTextRun[] = [];
  const re = /\x1b\[([0-9;]*)m/g;
  let lastIndex = 0;
  const state: AnsiState = {};

  const pushText = (text: string) => {
    if (!text) return;
    runs.push({ text, style: stateToStyle(state, baseColor) });
  };

  for (;;) {
    const m = re.exec(input);
    if (!m) break;

    if (m.index > lastIndex) {
      pushText(input.slice(lastIndex, m.index));
    }

    const raw = m[1] ?? "";
    const parts = raw.length ? raw.split(";") : ["0"];
    const codes: number[] = parts
      .map((p) => (p.length ? Number.parseInt(p, 10) : 0))
      .filter((n) => Number.isFinite(n));

    // Apply codes in order, consuming multi-parameter sequences as needed.
    for (let i = 0; i < codes.length; i++) {
      const code = codes[i]!;

      if (code === 0) {
        state.fg = undefined;
        state.bold = false;
        state.italic = false;
        state.underline = false;
        continue;
      }
      if (code === 1) {
        state.bold = true;
        continue;
      }
      if (code === 22) {
        state.bold = false;
        continue;
      }
      if (code === 3) {
        state.italic = true;
        continue;
      }
      if (code === 23) {
        state.italic = false;
        continue;
      }
      if (code === 4) {
        state.underline = true;
        continue;
      }
      if (code === 24) {
        state.underline = false;
        continue;
      }
      if (code === 39) {
        state.fg = undefined;
        continue;
      }

      // 16-color foreground
      if (code >= 30 && code <= 37) {
        state.fg = ANSI_16[code - 30];
        continue;
      }
      if (code >= 90 && code <= 97) {
        state.fg = ANSI_16[8 + (code - 90)];
        continue;
      }

      // Extended color (foreground): 38;5;n or 38;2;r;g;b
      if (code === 38) {
        const mode = codes[i + 1];
        if (mode === 5) {
          const n = codes[i + 2];
          if (typeof n === "number") {
            state.fg = xterm256ToHex(n) ?? state.fg;
          }
          i += 2;
          continue;
        }
        if (mode === 2) {
          const r = codes[i + 2];
          const g = codes[i + 3];
          const b = codes[i + 4];
          if (
            typeof r === "number" &&
            typeof g === "number" &&
            typeof b === "number"
          ) {
            state.fg = rgbToHex(r, g, b);
          }
          i += 4;
          continue;
        }
      }
    }

    lastIndex = re.lastIndex;
  }

  if (lastIndex < input.length) {
    pushText(input.slice(lastIndex));
  }

  // Merge adjacent runs with identical style to reduce nested Text nodes.
  const merged: AnsiTextRun[] = [];
  for (const r of runs) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.style.color === r.style.color &&
      prev.style.fontWeight === r.style.fontWeight &&
      prev.style.fontStyle === r.style.fontStyle &&
      prev.style.textDecorationLine === r.style.textDecorationLine
    ) {
      prev.text += r.text;
    } else {
      merged.push({ text: r.text, style: r.style });
    }
  }
  return merged;
}

