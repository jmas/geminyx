const DEFAULT_MAX_LINES = 10;
/** Also cap preview size so few logical lines with heavy wrapping do not blow up layout. */
const DEFAULT_MAX_CHARS = 2000;

function truncateEndAtBoundary(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastNl = cut.lastIndexOf("\n");
  if (lastNl >= Math.floor(maxLen * 0.65)) {
    return cut.slice(0, lastNl);
  }
  const lastSp = cut.lastIndexOf(" ");
  if (lastSp >= Math.floor(maxLen * 0.45)) {
    return cut.slice(0, lastSp);
  }
  return cut;
}

function isFenceLine(line: string): boolean {
  return line.startsWith("```");
}

/**
 * Truncated previews can end inside a ``` fence without a closing line. That
 * yields an unclosed pre in Gemtext and can confuse layout (e.g. last line
 * styling). When still unclosed after the preview lines:
 * - Drop the first line **inside** that block (opening line of code), per UX when
 *   the closing fence was cut off.
 * - Append a synthetic closing ``` so the remainder is a well-formed pre block.
 */
export function prepareTruncatedGemtextPreview(
  preview: string,
  wasTruncated: boolean,
): string {
  const normalized = preview.replace(/\r\n/g, "\n");
  if (!wasTruncated) return normalized;

  const lines = normalized.split("\n");
  let inPre = false;
  let openIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isFenceLine(lines[i])) {
      if (!inPre) {
        inPre = true;
        openIdx = i;
      } else {
        inPre = false;
        openIdx = -1;
      }
    }
  }
  if (!inPre || openIdx < 0) return normalized;

  const out = [...lines];
  const innerIdx = openIdx + 1;
  if (innerIdx < out.length && !isFenceLine(out[innerIdx])) {
    out.splice(innerIdx, 1);
  }
  if (openIdx + 1 >= out.length || isFenceLine(out[openIdx + 1])) {
    out.splice(openIdx, 1);
    return out.join("\n");
  }
  out.push("```");
  return out.join("\n");
}

export function truncateMessageToLines(
  text: string,
  maxLines: number = DEFAULT_MAX_LINES,
  maxChars: number = DEFAULT_MAX_CHARS,
): { preview: string; truncated: boolean } {
  if (!text) {
    return { preview: "", truncated: false };
  }
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  let truncated = false;
  let preview = normalized;

  if (lines.length > maxLines) {
    truncated = true;
    preview = lines.slice(0, maxLines).join("\n");
  }

  if (preview.length > maxChars) {
    truncated = true;
    preview = truncateEndAtBoundary(preview, maxChars);
  }

  return { preview, truncated };
}
