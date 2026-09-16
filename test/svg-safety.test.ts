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

  it("keeps runs of spaces, and asks for it by rule rather than by the style attribute a strict style-src blocks", () => {
    const item = createEmptyItem({ start: 0, end: 1, unit: "grapheme" });
    item.heading = "見 出  し";
    item.options = [{ code: "A", description: "説明  と   空白", noteRefs: [] }];
    const markup = renderToStaticMarkup(
      DiagramSvg({ layout: computeLayout("A B", [item], 2400), code: "A B", background: "transparent", accent: "#2563eb" }),
    );

    // the spaces survive into the markup...
    expect(markup).toContain("見 出  し");
    expect(markup).toContain("説明  と   空白");
    // ...and nothing asks for them through a style attribute
    expect(markup).not.toContain("style=");
    expect(markup).toContain('xml:space="preserve"');
    expect(markup).toContain("diagram-svg");
  });

});

describe("characters XML does not allow", () => {
  it("are stripped from everything the diagram draws, so the SVG stays parseable", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { DiagramSvg } = await import("../src/components/DiagramSvg");
    const { stripInvalidXmlChars, hasInvalidXmlChars } = await import("../src/lib/xmlText");
    const bad = "\u0008\u001b\uffff";
    const item = createEmptyItem({ start: 0, end: 2, unit: "grapheme" });
    item.heading = `見出し${bad}`;
    item.options = [{ code: `A${bad}`, description: `説明${bad}`, noteRefs: [] }];
    const notes = [{ id: "n", text: `注記${bad}` }];
    const layout = computeLayout(`AB${bad}`, [item], 2400, notes);
    const markup = renderToStaticMarkup(DiagramSvg({ layout, code: `AB${bad}`, background: "transparent", accent: "#000000" }));
    expect(hasInvalidXmlChars(markup)).toBe(false);
    expect(checkSvgSafety(markup)).toEqual([]);
    expect(stripInvalidXmlChars("a\u0009b\u000ac\u2028d\u{1F600}")).toBe("a\u0009b\u000ac\u2028d\u{1F600}");
  });

  it("are reported by the safety scan if they ever reach the markup", () => {
    expect(checkSvgSafety("<svg><text>x\u0008</text></svg>").some((i) => i.code === "invalid-xml-char")).toBe(true);
  });
});

describe("preview-only extras", () => {
  it("leaves the clickable patches out of the exported markup", () => {
    const item = createEmptyItem({ start: 0, end: 2, unit: "grapheme" });
    item.heading = "見出し";
    const layout = computeLayout("AB", [item], 2400);
    const exported = renderToStaticMarkup(DiagramSvg({ layout, code: "AB", background: "transparent", accent: "#000000" }));
    expect(exported).not.toContain("item-hit");
    expect(exported).not.toContain("<title>");
    const preview = renderToStaticMarkup(
      DiagramSvg({ layout, code: "AB", background: "transparent", accent: "#000000", onSelectItem: () => {} }),
    );
    expect(preview).toContain("item-hit");
    expect(checkSvgSafety(exported)).toEqual([]);
  });
});
