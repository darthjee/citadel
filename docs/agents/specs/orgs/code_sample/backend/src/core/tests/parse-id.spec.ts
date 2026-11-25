import { NotFoundException } from '@nestjs/common';
import { MAX_ID, ownerNotFound, parseId } from '../parse-id.js';

describe('parseId', () => {
  it.each([
    ['1', 1],
    ['42', 42],
    [String(MAX_ID), MAX_ID],
  ])('parses %p as %p', (raw, expected) => {
    expect(parseId(raw)).toBe(expected);
  });

  it.each(['abc', '007', '0', '-1', '1.5', '1e3', '+1', ' 1', '', '99999999999', String(MAX_ID + 1)])(
    'throws the uniform 404 for %p',
    (raw) => {
      expect(() => parseId(raw)).toThrow(NotFoundException);
    },
  );

  it.each([1, undefined, null, ['1']])('throws the uniform 404 for the non-string %p', (raw) => {
    expect(() => parseId(raw)).toThrow(NotFoundException);
  });

  it('throws exactly the ownerNotFound() body', () => {
    let thrown: unknown;

    try {
      parseId('x');
    } catch (error) {
      thrown = error;
    }

    expect((thrown as NotFoundException).getResponse()).toEqual(ownerNotFound().getResponse());
  });
});
