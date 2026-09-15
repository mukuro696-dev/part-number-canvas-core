export const PNG_WIDTH_PRESETS = [1200, 2400, 3600] as const;
export const PNG_WIDTH_MIN = 800;
export const PNG_WIDTH_MAX = 4000;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("failed to rasterize the SVG (it may reference something the browser could not load)"));
    img.src = src;
  });
}

/**
 * Rasterizes an already-self-contained SVG string (see buildExportSvg)
 * to a PNG Blob via an offscreen canvas. Height is derived from the
 * SVG's own viewBox aspect ratio, matching the "SVGとPNGの内容一致"
 * requirement (Phase 1 §12).
 */
export async function svgToPngBlob(params: {
  svg: string;
  viewBoxWidth: number;
  viewBoxHeight: number;
  outputWidthPx: number;
  background: "transparent" | "white";
}): Promise<Blob> {
  const { svg, viewBoxWidth, viewBoxHeight, outputWidthPx, background } = params;
  if (outputWidthPx < PNG_WIDTH_MIN || outputWidthPx > PNG_WIDTH_MAX) {
    throw new Error(`PNG width must be between ${PNG_WIDTH_MIN} and ${PNG_WIDTH_MAX}px`);
  }
  const outputHeightPx = Math.max(1, Math.round((viewBoxHeight / viewBoxWidth) * outputWidthPx));

  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = outputWidthPx;
    canvas.height = outputHeightPx;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable in this browser");

    if (background === "white") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("canvas.toBlob returned null");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
