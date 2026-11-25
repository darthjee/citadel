import { NotFoundException } from '@nestjs/common';

// Largest value of MySQL's signed `int` primary key.
export const MAX_ID = 2147483647;

const ID_PATTERN = /^[1-9][0-9]*$/;

/**
 * Builds the uniform owner-scoped 404. The owner-context guard, the id
 * parsers and the owner-scoped services all throw it, so an unknown,
 * malformed, foreign or wrong-context id produce byte-identical bodies (apart
 * from `timestamp`).
 * @returns {NotFoundException} The uniform not-found exception.
 */
export function ownerNotFound(): NotFoundException {
  return new NotFoundException();
}

/**
 * Parses a raw numeric route parameter (`:orgId`, `:accountId`,
 * `:transactionId`, …) strictly: only strings matching `^[1-9][0-9]*$` with a
 * value up to {@link MAX_ID} are accepted. Anything else (`abc`, `007`, `-1`,
 * `1.5`, `1e3`, out of range, non-strings) answers the uniform 404 — never a
 * 400 (unlike `ParseIntPipe`), so malformed ids are indistinguishable from
 * unknown ones.
 * @param {unknown} raw - The raw route parameter.
 * @returns {number} The id.
 */
export function parseId(raw: unknown): number {
  if (typeof raw !== 'string' || !ID_PATTERN.test(raw)) {
    throw ownerNotFound();
  }

  const id = Number(raw);

  if (id > MAX_ID) {
    throw ownerNotFound();
  }

  return id;
}
