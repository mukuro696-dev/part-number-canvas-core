// Hand-written types for the generated validator (ajv emits plain JavaScript).
import type { ErrorObject } from "ajv";

export interface CompiledValidator {
  (data: unknown): boolean;
  errors?: ErrorObject[] | null;
}

export declare const validate: CompiledValidator;
export default validate;
