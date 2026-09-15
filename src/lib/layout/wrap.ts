import { toGraphemes } from "../graphemes";

/**
 * Wrap text into lines of at most `maxCharsPerLine` grapheme clusters.
 * Breaks at whitespace when possible; falls back to a hard break inside
 * a long unbroken run rather than overflowing the line (a grapheme
 * cluster itself is never split).
 */
export function wrapText(text: string, maxCharsPerLine: number): string[] {
  if (maxCharsPerLine < 1) throw new Error("maxCharsPerLine must be >= 1");
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];

  const words = trimmed.split(/(\s+)/).filter((w) => w.length > 0 && !/^\s+$/.test(w));
  const lines: string[] = [];
  let current = "";
  let currentLen = 0;

  function pushCurrent() {
    if (current.length > 0) {
      lines.push(current);
      current = "";
      currentLen = 0;
    }
  }

  for (const word of words) {
    const wordGraphemes = toGraphemes(word);

    if (wordGraphemes.length > maxCharsPerLine) {
      pushCurrent();
      for (let i = 0; i < wordGraphemes.length; i += maxCharsPerLine) {
        lines.push(wordGraphemes.slice(i, i + maxCharsPerLine).join(""));
      }
      continue;
    }

    const separator = currentLen > 0 ? 1 : 0;
    if (currentLen + separator + wordGraphemes.length > maxCharsPerLine) {
      pushCurrent();
      current = word;
      currentLen = wordGraphemes.length;
    } else {
      current = currentLen > 0 ? `${current} ${word}` : word;
      currentLen += separator + wordGraphemes.length;
    }
  }
  pushCurrent();
  return lines;
}
