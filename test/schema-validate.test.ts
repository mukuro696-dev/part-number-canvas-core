import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { validateDocument, parseAndValidateJson } from "../src/lib/schema/validate";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

function readFixture(name: string): string {
  return readFileSync(path.join(fixturesDir, name), "utf-8");
}

describe("validateDocument", () => {
  it("accepts a valid fixture (aster-beacon-x2)", () => {
    const doc = JSON.parse(readFixture("aster-beacon-x2.json"));
    const result = validateDocument(doc);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("accepts a valid fixture (nova-clamp-v3)", () => {
    const doc = JSON.parse(readFixture("nova-clamp-v3.json"));
    const result = validateDocument(doc);
    expect(result.valid).toBe(true);
  });

  it("rejects a schemaVersion from the future (fail closed, no silent migration)", () => {
    const doc = JSON.parse(readFixture("invalid-future-schema-version.json"));
    const result = validateDocument(doc);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/unsupported schemaVersion/);
  });

  it("rejects a document missing a required field", () => {
    const doc = JSON.parse(readFixture("invalid-missing-required-field.json"));
    const result = validateDocument(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects non-object input", () => {
    expect(validateDocument(null).valid).toBe(false);
    expect(validateDocument("not an object").valid).toBe(false);
    expect(validateDocument(42).valid).toBe(false);
  });

  it("rejects unknown extra properties (additionalProperties: false)", () => {
    const doc = JSON.parse(readFixture("aster-beacon-x2.json"));
    doc.unexpectedField = "should not be allowed";
    const result = validateDocument(doc);
    expect(result.valid).toBe(false);
  });
});

describe("parseAndValidateJson", () => {
  it("parses and validates a well-formed JSON string", () => {
    const result = parseAndValidateJson(readFixture("aster-beacon-x2.json"));
    expect("document" in result).toBe(true);
  });

  it("rejects malformed JSON text", () => {
    const result = parseAndValidateJson("{ not valid json");
    expect("errors" in result).toBe(true);
  });

  it("rejects a document larger than the 2 MiB limit", () => {
    const doc = JSON.parse(readFixture("aster-beacon-x2.json"));
    doc.model.notes[0].text = "x".repeat(3 * 1024 * 1024);
    const result = parseAndValidateJson(JSON.stringify(doc));
    expect("errors" in result).toBe(true);
    if ("errors" in result) {
      expect(result.errors[0]).toMatch(/byte limit/);
    }
  });
});

describe("the compiled validator", () => {
  it("matches the schema it was generated from (re-run scripts/build-schema-validator.mjs after editing the schema)", async () => {
    const { generateValidatorSource } = await import("../scripts/build-schema-validator.mjs");
    const committed = readFileSync(
      fileURLToPath(new URL("../src/lib/schema/validator.generated.mjs", import.meta.url)),
      "utf-8",
    );
    expect(generateValidatorSource()).toBe(committed);
    // a leftover CommonJS require throws in the browser as soon as the module loads
    expect(committed).not.toMatch(/\brequire\(/);
  });

  it("is ordinary code, so a page embedding it needs no 'unsafe-eval'", async () => {
    const { generateValidatorSource } = await import("../scripts/build-schema-validator.mjs");
    const source = generateValidatorSource();
    expect(source).not.toMatch(/\bnew Function\b/);
    expect(source).not.toMatch(/\beval\(/);
  });
});
