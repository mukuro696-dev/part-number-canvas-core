import { LAYOUT, type DiagramLayout } from "../lib/layout/computeLayout";

export interface DiagramSvgProps {
  layout: DiagramLayout;
  code: string;
  background: "transparent" | "white";
  accent: string;
  /** grapheme range currently highlighted as a pending selection, if any */
  pendingRange?: { start: number; end: number } | null;
  /** preview only: each item's characters tinted with the colour its card uses (never passed for export) */
  rangeTints?: { start: number; end: number; color: string }[];
  /** CSS font-family value for the part-number row */
  codeFontFamily?: string;
  /** CSS font-family value for headings/descriptions */
  bodyFontFamily?: string;
}

const DEFAULT_CODE_FONT_FAMILY = "ui-monospace, SFMono-Regular, Menlo, monospace";
const DEFAULT_BODY_FONT_FAMILY = "sans-serif";

/** Safe, script-free SVG built from JSX (React escapes all text content). */
export function DiagramSvg({
  layout,
  code,
  background,
  accent,
  pendingRange,
  rangeTints = [],
  codeFontFamily = DEFAULT_CODE_FONT_FAMILY,
  bodyFontFamily = DEFAULT_BODY_FONT_FAMILY,
}: DiagramSvgProps) {
  const { svgWidth, height, codeRowY, codeX, charX, placed, footnotes, footnoteX, footnotesRuleY, footnotesRuleEndX } = layout;
  const supSize = LAYOUT.optionSize * LAYOUT.supScale;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${svgWidth} ${height}`}
      width="100%"
      role="img"
      aria-label={`Part number diagram for ${code}`}
      className={background === "white" ? "diagram-bg-white" : "diagram-bg-transparent"}
      fill="#000000"
      // positions are measured with every space kept, so the drawing must not collapse runs of spaces
      xmlSpace="preserve"
      style={{ whiteSpace: "pre" }}
    >
      {rangeTints.map((tint, i) => (
        <rect
          key={`tint-${i}`}
          x={charX(tint.start)}
          y={codeRowY - LAYOUT.codeSize * 0.8}
          width={charX(tint.end) - charX(tint.start)}
          height={LAYOUT.codeSize}
          fill={tint.color}
        />
      ))}
      {pendingRange && pendingRange.end > pendingRange.start && (
        <rect
          x={charX(pendingRange.start)}
          y={codeRowY - LAYOUT.codeSize * 0.8}
          width={charX(pendingRange.end) - charX(pendingRange.start)}
          height={LAYOUT.codeSize}
          fill="#2563eb"
          opacity={0.15}
        />
      )}

      <text x={codeX} y={codeRowY} fontFamily={codeFontFamily} fontSize={LAYOUT.codeSize} fontWeight={700}>
        {code}
      </text>

      {placed.map(({ item, underline, leader, rule, label }) => {
        const [top, bend, end] = leader.points;
        return (
          <g key={item.id}>
            <line
              x1={underline.a.x}
              y1={underline.a.y}
              x2={underline.b.x}
              y2={underline.b.y}
              stroke={accent}
              strokeWidth={LAYOUT.underlineStroke}
            />
            <path
              d={`M${top.x} ${top.y} V${bend.y} H${end.x}`}
              fill="none"
              stroke={accent}
              strokeWidth={LAYOUT.leaderStroke}
            />
            <line x1={rule.a.x} y1={rule.a.y} x2={rule.b.x} y2={rule.b.y} stroke={accent} strokeWidth={LAYOUT.leaderStroke} />
            <text x={label.x} y={label.headingY} fontFamily={bodyFontFamily} fontSize={LAYOUT.headingSize} fontWeight={700}>
              {label.headingText}
            </text>
            {label.options.map((option, oi) => (
              <g key={oi}>
                {option.codeText && (
                  <text
                    x={label.x + label.codeColumnWidth - option.codeWidth}
                    y={option.y}
                    fontFamily={bodyFontFamily}
                    fontSize={LAYOUT.optionSize}
                  >
                    {option.codeText}
                  </text>
                )}
                {option.descLines.map((line, li) => (
                  <text
                    key={li}
                    x={label.x + label.codeColumnWidth + (li > 0 ? LAYOUT.optionSize : 0)}
                    y={option.y + li * LAYOUT.softLead}
                    fontFamily={bodyFontFamily}
                    fontSize={LAYOUT.optionSize}
                  >
                    {line.map((run, ri) =>
                      run.sup ? (
                        <tspan key={ri} baselineShift="super" fontSize={supSize}>
                          {run.text}
                        </tspan>
                      ) : (
                        <tspan key={ri}>{run.text}</tspan>
                      ),
                    )}
                  </text>
                ))}
              </g>
            ))}
          </g>
        );
      })}

      {footnotesRuleY !== null && (
        <line x1={footnoteX} y1={footnotesRuleY} x2={footnotesRuleEndX} y2={footnotesRuleY} stroke="#cccccc" strokeWidth={1} />
      )}
      {footnotes.map((fn) => (
        <text key={`footnote-${fn.number}`} x={footnoteX} y={fn.y} fontFamily={bodyFontFamily} fontSize={LAYOUT.footnoteSize}>
          {fn.lines.map((line, i) => (
            <tspan key={i} x={footnoteX} dy={i === 0 ? 0 : LAYOUT.footnoteSize * LAYOUT.footnoteLineHeight}>
              {line}
            </tspan>
          ))}
        </text>
      ))}
    </svg>
  );
}
