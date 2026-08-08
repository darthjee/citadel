import pickDefined from '../../../../assets/js/client/pickDefined.js';

describe('pickDefined', () => {
  it('omits keys whose value is undefined', () => {
    expect(pickDefined({ a: 1, b: undefined, c: 'x' })).toEqual({ a: 1, c: 'x' });
  });

  it('keeps empty strings, null, zero and false', () => {
    const input = {
      empty: '', nothing: null, zero: 0, no: false,
    };

    expect(pickDefined(input)).toEqual(input);
  });

  it('returns an empty object when every value is undefined', () => {
    expect(pickDefined({ a: undefined, b: undefined })).toEqual({});
  });

  it('returns an empty object for an empty input', () => {
    expect(pickDefined({})).toEqual({});
  });

  it('does not mutate the input object', () => {
    const input = { a: 1, b: undefined };

    pickDefined(input);

    expect(input).toEqual({ a: 1, b: undefined });
  });
});
