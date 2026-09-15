import type { PartNumberItem, PartNumberNote } from "../lib/schema/types";
import { computeLayout, LAYOUT } from "../lib/layout/computeLayout";

export interface DiagramSvgProps {
  code: string;
  items: PartNumberItem[];
  notes?: PartNumberNote[];
  svgWidth: number;
  background: "transparent" | "white";
  accent: string;
  /** grapheme range currently highlighted as a pending selection, if any */
  pendingRange?: { start: number; end: number } | null;
  /** CSS font-family value for the part-number row; falls back to a system monospace stack */
  codeFontFamily?: string;
  /** CSS font-family value for headings/descriptions; falls back to sans-serif */
  bodyFontFamily?: string;
}

const DEFAULT_CODE_FONT_FAMILY = "ui-monospace, SFMono-Regular, Menlo, monospace";
const DEFAULT_BODY_FONT_FAMILY = "sans-serif";

/** Safe, script-free SVG built from JSX (React escapes all text content). */
export function DiagramSvg({
  code,
  items,
  notes = [],
  svgWidth,
  background,
  accent,
  pendingRange,
  codeFontFamily = DEFAULT_CODE_FONT_FAMILY,
  bodyFontFamily = DEFAULT_BODY_FONT_FAMILY,
}: DiagramSvgProps) {
  const layout = computeLayout(code, items, svgWidth, notes);
  const { graphemes, charX, codeRowY, height, placed, footnotes, footnotesRuleY } = layout;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${svgWidth} ${height}`}
      width="100%"
      role="img"
      aria-label={`Part number diagram for ${code}`}
      className={background === "white" ? "diagram-bg-white" : "diagram-bg-transparent"}
    >
      {graphemes.map((g, i) => (
        <text
          key={`char-${i}`}
          x={charX(i) + LAYOUT.charWidth / 2}
          y={codeRowY}
          fontFamily={codeFontFamily}
          fontSize={LAYOUT.fontSize}
          textAnchor="middle"
          fill="#111827"
        >
          {g}
        </text>
      ))}

      {pendingRange && pendingRange.end > pendingRange.start && (
        <rect
          x={charX(pendingRange.start)}
          y={codeRowY - LAYOUT.fontSize}
          width={charX(pendingRange.end) - charX(pendingRange.start)}
          height={LAYOUT.fontSize + 10}
          fill={accent}
          opacity={0.15}
        />
      )}

      {placed.map(({ item, underline, leader, label }) => {
        const firstLineY = label.bbox.y + LAYOUT.headingLineHeight * 0.8;
        return (
          <g key={item.id}>
            <line x1={underline.a.x} y1={underline.a.y} x2={underline.b.x} y2={underline.b.y} stroke={accent} strokeWidth={3} />
            <polyline
              points={leader.points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={accent}
              strokeWidth={1.5}
            />
            <text
              x={label.x}
              y={firstLineY}
              textAnchor={label.anchor}
              fontFamily={bodyFontFamily}
              fontSize={LAYOUT.headingFontSize}
              fontWeight={700}
              fill="#111827"
            >
              {label.headingLines.map((line, i) => (
                <tspan key={i} x={label.x} dy={i === 0 ? 0 : LAYOUT.headingLineHeight}>
                  {line}
                </tspan>
              ))}
            </text>
            {label.bodyLines.length > 0 && (
              <text
                x={label.x}
                y={firstLineY + label.headingLines.length * LAYOUT.headingLineHeight}
                textAnchor={label.anchor}
                fontFamily={bodyFontFamily}
                fontSize={LAYOUT.bodyFontSize}
                fill="#374151"
              >
                {label.bodyLines.map((line, i) => (
                  <tspan key={i} x={label.x} dy={i === 0 ? 0 : LAYOUT.bodyLineHeight}>
                    {line}
                  </tspan>
                ))}
              </text>
            )}
          </g>
        );
      })}

      {footnotesRuleY !== null && (
        <line x1={LAYOUT.marginX} y1={footnotesRuleY} x2={svgWidth - LAYOUT.marginX} y2={footnotesRuleY} stroke="#e2e8f0" strokeWidth={1} />
      )}
      {footnotes.map((fn) => (
        <text
          key={`footnote-${fn.number}`}
          x={LAYOUT.marginX}
          y={fn.y + LAYOUT.bodyLineHeight * 0.8}
          fontFamily={bodyFontFamily}
          fontSize={LAYOUT.bodyFontSize}
          fill="#374151"
        >
          {fn.lines.map((line, i) => (
            <tspan key={i} x={LAYOUT.marginX} dy={i === 0 ? 0 : LAYOUT.bodyLineHeight}>
              {line}
            </tspan>
          ))}
        </text>
      ))}
    </svg>
  );
}
