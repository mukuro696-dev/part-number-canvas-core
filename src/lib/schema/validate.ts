// The validator is compiled from the schema at build time
// (scripts/build-schema-validator.mjs). Compiling it here instead would need
// `new Function(...)`, and with it 'unsafe-eval' in the site's CSP.
import { validate as validateFn } from "./validator.generated.mjs";
import type { PartNumberDocument } from "./types";
import { SCHEMA_LIMITS } from "./types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Fail-closed JSON validation: unknown structure, wrong types, or
 * over-limit input is rejected rather than best-effort coerced.
 */
export function validateDocument(input: unknown): ValidationResult {
  if (typeof input !== "object" || input === null) {
    return { valid: false, errors: ["document must be a JSON object"] };
  }

  const record = input as Record<string, unknown>;
  if (record.schemaVersion !== 1) {
    return {
      valid: false,
      errors: [`unsupported schemaVersion: ${JSON.stringify(record.schemaVersion)} (expected 1)`],
    };
  }

  const ok = validateFn(input);
  if (ok) {
    return { valid: true, errors: [] };
  }

  const errors = (validateFn.errors ?? []).map(
    (e) => `${e.instancePath || "(root)"} ${e.message ?? "invalid"}`,
  );
  return { valid: false, errors };
}

export function parseAndValidateJson(jsonText: string): { document: PartNumberDocument } | { errors: string[] } {
  if (new TextEncoder().encode(jsonText).length > SCHEMA_LIMITS.maxJsonBytes) {
    return { errors: [`file exceeds ${SCHEMA_LIMITS.maxJsonBytes} byte limit`] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    return { errors: [`invalid JSON: ${(e as Error).message}`] };
  }

  const result = validateDocument(parsed);
  if (!result.valid) {
    return { errors: result.errors };
  }
  return { document: parsed as PartNumberDocument };
}
