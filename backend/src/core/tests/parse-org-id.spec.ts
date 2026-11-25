import { NotFoundException } from '@nestjs/common';
import { MAX_ORG_ID, ownerNotFound, parseOrgId } from '../parse-org-id.js';

describe('parseOrgId', () => {
  describe('with a valid id', () => {
    it.each([
      ['1', 1],
      ['42', 42],
      ['1000', 1000],
      [String(MAX_ORG_ID), MAX_ORG_ID],
    ])('parses %p as %p', (raw, expected) => {
      expect(parseOrgId(raw)).toBe(expected);
    });
  });

  describe('with a malformed or out-of-range id', () => {
    it.each([
      'abc',
      '007',
      '0',
      '-1',
      '1.5',
      '1e3',
      '+1',
      ' 1',
      '1 ',
      '0x10',
      '',
      '99999999999',
      String(MAX_ORG_ID + 1),
    ])('throws the uniform 404 for %p', (raw) => {
      expect(() => parseOrgId(raw)).toThrow(NotFoundException);
    });
  });

  describe('with a non-string value', () => {
    it.each([1, undefined, null, ['1'], { id: '1' }])('throws the uniform 404 for %p', (raw) => {
      expect(() => parseOrgId(raw)).toThrow(NotFoundException);
    });
  });

  it('throws exactly the ownerNotFound() exception body', () => {
    let thrown: unknown;

    try {
      parseOrgId('abc');
    } catch (error) {
      thrown = error;
    }

    expect((thrown as NotFoundException).getResponse()).toEqual(ownerNotFound().getResponse());
  });
});

describe('ownerNotFound', () => {
  it('returns a NotFoundException with the default body', () => {
    const exception = ownerNotFound();

    expect(exception).toBeInstanceOf(NotFoundException);
    expect(exception.getStatus()).toBe(404);
    expect(exception.getResponse()).toEqual({ message: 'Not Found', statusCode: 404 });
  });

  it('returns identical bodies on every call', () => {
    expect(ownerNotFound().getResponse()).toEqual(ownerNotFound().getResponse());
  });
});
