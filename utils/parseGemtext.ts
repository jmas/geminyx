/**
 * Minimal Gemtext (text/gemini) parsing for message bodies.
 * @see https://gemini.circumlunar.space/docs/specification.gmi
 */

export type GemtextSegment =
  | { type: "text"; text: string }
  | { type: "link"; href: string; label: string }
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "quote"; text: string }
  | { type: "list"; text: string }
  | { type: "pre"; text: string };

export function parseGemtext(input: string): GemtextSegment[] {
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  const segments: GemtextSegment[] = [];
  let preLines: string[] | null = null;
  const plainLines: string[] = [];

  function flushPlain() {
    if (plainLines.length === 0) return;
    const text = plainLines.join("\n");
    plainLines.length = 0;
    if (text.length > 0) {
      segments.push({ type: "text", text });
    }
  }

  for (const line of lines) {
    if (preLines !== null) {
      if (line.startsWith("```")) {
        segments.push({ type: "pre", text: preLines.join("\n") });
        preLines = null;
      } else {
        preLines.push(line);
      }
      continue;
    }

    if (line.startsWith("```")) {
      flushPlain();
      preLines = [];
      continue;
    }

    const link = line.match(/^=>\s*(\S+)(?:\s+(.*))?$/);
    if (link) {
      flushPlain();
      const href = link[1];
      const labelRaw = link[2]?.trim();
      const label = labelRaw && labelRaw.length > 0 ? labelRaw : href;
      segments.push({ type: "link", href, label });
      continue;
    }

    if (line.startsWith("###")) {
      const m = line.match(/^###\s+(.*)$/);
      if (m) {
        flushPlain();
        segments.push({ type: "heading", level: 3, text: m[1] });
        continue;
      }
    }
    if (line.startsWith("##")) {
      const m = line.match(/^##\s+(.*)$/);
      if (m) {
        flushPlain();
        segments.push({ type: "heading", level: 2, text: m[1] });
        continue;
      }
    }
    if (line.startsWith("#")) {
      const m = line.match(/^#\s+(.*)$/);
      if (m) {
        flushPlain();
        segments.push({ type: "heading", level: 1, text: m[1] });
        continue;
      }
    }

    if (line.startsWith(">")) {
      const m = line.match(/^>\s?(.*)$/);
      flushPlain();
      segments.push({ type: "quote", text: m ? m[1] : "" });
      continue;
    }

    const list = line.match(/^\*\s+(.*)$/);
    if (list) {
      flushPlain();
      segments.push({ type: "list", text: list[1] });
      continue;
    }

    plainLines.push(line);
  }

  if (preLines !== null) {
    flushPlain();
    segments.push({ type: "pre", text: preLines.join("\n") });
  } else {
    flushPlain();
  }

  return segments;
}
