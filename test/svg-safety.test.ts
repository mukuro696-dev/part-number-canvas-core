import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { checkSvgSafety } from "../src/lib/svg-safety";
import { DiagramSvg } from "../src/components/DiagramSvg";
import { createEmptyItem } from "../src/lib/document";
import { computeLayout } from "../src/lib/layout/computeLayout";

describe("checkSvgSafety (detector)", () => {
  it("flags a <script> element", () => {
    const markup = `<svg><script>alert(1)</script></svg>`;
    expect(checkSvgSafety(markup).some((i) => i.code === "script")).toBe(true);
  });

  it("flags a foreignObject element", () => {
    const markup = `<svg><foreignObject><div>x</div></foreignObject></svg>`;
    expect(checkSvgSafety(markup).some((i) => i.code === "foreign-object")).toBe(true);
  });

  it("flags an inline event-handler attribute", () => {
    const markup = `<svg><rect onclick="alert(1)" /></svg>`;
    expect(checkSvgSafety(markup).some((i) => i.code === "event-handler")).toBe(true);
  });

  it("flags an external href reference", () => {
    const markup = `<svg><a href="https://example.com"><text>x</text></a></svg>`;
    expect(checkSvgSafety(markup).some((i) => i.code === "external-reference")).toBe(true);
  });

  it("flags an unresolved template token", () => {
    const markup = `<svg><text>{{heading}}</text></svg>`;
    expect(checkSvgSafety(markup).some((i) => i.code === "unresolved-token")).toBe(true);
  });

  it("passes clean, static SVG markup", () => {
    const markup = `<svg viewBox="0 0 100 100"><text x="10" y="10">ABX-120-RN</text></svg>`;
    expect(checkSvgSafety(markup)).toEqual([]);
  });
});

describe("DiagramSvg rendered output", () => {
  it("stays safe even with adversarial-looking item text (React escapes it)", () => {
    const item = createEmptyItem({ start: 0, end: 1, unit: "grapheme" });
    item.heading = '<script>alert(1)</script><img src=x onerror="alert(1)">';
    item.options = [{ code: 'javascript:alert(1)', description: '" onclick="alert(1)', noteRefs: [] }];

    const markup = renderToStaticMarkup(
      DiagramSvg({
        layout: computeLayout("A", [item], 2400),
        code: "A",
        background: "transparent",
        accent: "#2563eb",
      }),
    );

    expect(checkSvgSafety(markup)).toEqual([]);
    // the adversarial text is present, but only as escaped text content
    expect(markup).toContain("&lt;script&gt;");
    expect(markup).not.toContain("<script>");
  });

  it("declares the SVG namespace (required to load the exported file as a standalone image, e.g. for PNG rasterization)", () => {
    const markup = renderToStaticMarkup(
      DiagramSvg({ layout: computeLayout("ABX-120-RN", [], 2400), code: "ABX-120-RN", background: "transparent", accent: "#2563eb" }),
    );
    expect(markup).toContain('xmlns="http://www.w3.org/2000/svg"');
  });
});
