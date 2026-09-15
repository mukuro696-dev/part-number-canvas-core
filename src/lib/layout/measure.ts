import type { MeasureText, TextRole } from "./computeLayout";

export interface FontFamilies {
  /** CSS font-family value for the code row */
  code: string;
  /** CSS font-family value for headings and descriptions */
  body: string;
}

const WEIGHT: Record<TextRole, number> = { code: 700, heading: 700, body: 400 };

const fontShorthand = (families: FontFamilies, role: TextRole, size: number) =>
  `${WEIGHT[role]} ${size}px ${role === "code" ? families.code : families.body}`;

/**
 * Asks the browser for real text widths instead of estimating them —
 * glyph widths vary by font and script, so only the browser's own
 * shaping gives positions that match what it draws.
 */
export function createCanvasMeasurer(families: FontFamilies): MeasureText {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  const cache = new Map<string, number>();
  return (text, role, size) => {
    const key = `${role}|${size}|${text}`;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    ctx.font = fontShorthand(families, role, size);
    const width = ctx.measureText(text).width;
    cache.set(key, width);
    return width;
  };
}

/**
 * Measuring before a web font has loaded silently measures the fallback
 * font instead. `document.fonts.ready` only covers faces already in use,
 * so each face is requested explicitly with Latin and Japanese samples
 * (the body families split the two scripts across separate faces).
 */
export async function loadMeasurementFonts(families: FontFamilies): Promise<void> {
  await Promise.all([
    document.fonts.load(fontShorthand(families, "code", 40), "0A-"),
    document.fonts.load(fontShorthand(families, "heading", 40), "Aあ亜"),
    document.fonts.load(fontShorthand(families, "body", 40), "Aあ亜"),
  ]);
}
