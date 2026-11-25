import type { TransformFnParams } from 'class-transformer';
import { registerDecorator, type ValidationOptions } from 'class-validator';

/**
 * `@Transform` callback trimming a string value; any other value (missing, a number, an array, …)
 * is returned unchanged so the type validators (e.g. `@IsString()`) still reject it.
 * @param {TransformFnParams} params - The class-transformer params; only `value` is read.
 * @returns {unknown} The trimmed string, or the original non-string value.
 */
export function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/**
 * Counts a string's Unicode code points (an astral character such as an emoji counts once, unlike
 * `String#length`, which counts UTF-16 units).
 * @param {string} value - The string to measure.
 * @returns {number} The number of code points.
 */
export function codePointLength(value: string): number {
  return [...value].length;
}

/**
 * Property decorator rejecting a string longer than `max` **code points** (constraint name
 * `maxCodePoints`). Matches MySQL's `varchar(n)` (`utf8mb4`), which counts characters, not UTF-16
 * units. Non-string values pass, so pair it with `@IsString()`.
 * @param {number} max - The maximum number of code points.
 * @param {ValidationOptions} [validationOptions] - Optional class-validator options.
 * @returns {PropertyDecorator} The decorator.
 */
export function MaxCodePoints(max: number, validationOptions?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol): void => {
    registerDecorator({
      name: 'maxCodePoints',
      target: target.constructor,
      propertyName: String(propertyName),
      constraints: [max],
      options: { message: `$property must be at most ${max} characters`, ...validationOptions },
      validator: {
        validate: (value: unknown): boolean => typeof value !== 'string' || codePointLength(value) <= max,
      },
    });
  };
}
