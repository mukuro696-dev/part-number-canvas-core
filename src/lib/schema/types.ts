export type Side = "left" | "right" | "auto";
export type Background = "transparent" | "white";
export type BodyFont = "gothic" | "mincho" | "design";
export type CodeFont = "robotoCondensed" | "barlowCondensed" | "ibmPlexSansCondensed";

export interface PartNumberRange {
  /** 0-based, grapheme-cluster count (not UTF-16 code units) */
  start: number;
  /** exclusive */
  end: number;
  unit: "grapheme";
}

export interface PartNumberOption {
  code: string;
  description: string;
  noteRefs: string[];
}

export interface PartNumberItem {
  id: string;
  range: PartNumberRange;
  heading: string;
  side: Side;
  options: PartNumberOption[];
}

export interface PartNumberNote {
  id: string;
  text: string;
}

export interface PartNumberDocument {
  schemaVersion: 1;
  app: "part-number-canvas";
  documentId: string;
  revision: number;
  meta: {
    title: string;
    locale: string;
    createdAt: string;
    updatedAt: string;
  };
  model: {
    code: string;
    items: PartNumberItem[];
    notes: PartNumberNote[];
  };
  appearance: {
    codeFont: CodeFont;
    bodyFont: BodyFont;
    background: Background;
    accent: string;
  };
  export: {
    svgWidth: number;
    pngWidth: number;
  };
}

export const SCHEMA_LIMITS = {
  maxCodeGraphemes: 120,
  maxItems: 40,
  maxOptionsPerItem: 30,
  maxNotes: 50,
  maxTextGraphemes: 500,
  maxJsonBytes: 2 * 1024 * 1024,
} as const;
