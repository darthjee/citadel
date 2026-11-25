import {
  LIST_HAS_ITEMS_MESSAGE,
  dispatchTodoError,
  fieldErrorsFromDetails,
} from '../../../../../../../../assets/js/components/resources/todo/pages/controllers/todoErrors.js';
import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import sessionExpiredError from '../../../../../../../support/sessionExpiredError.js';

describe('todoErrors', () => {
  describe('dispatchTodoError', () => {
    let outcomes;

    beforeEach(() => {
      outcomes = jasmine.createSpyObj('outcomes', [
        'onError', 'onNotFound', 'onForbidden', 'onValidation', 'onListHasItems', 'onSessionExpired',
      ]);
    });

    [
      [new ApiError(404, 'Not found', 'NOT_FOUND'), 'onNotFound'],
      [new ApiError(403, 'Forbidden', 'FORBIDDEN'), 'onForbidden'],
      [new ApiError(400, 'bad', 'VALIDATION_FAILED', ['name should not be empty']), 'onValidation'],
      [new ApiError(409, 'has items', 'LIST_HAS_ITEMS'), 'onListHasItems'],
      [new ApiError(500, 'boom'), 'onError'],
      [new Error('network'), 'onError'],
    ].forEach(([error, outcome]) => {
      it(`routes ${error.status ?? 'a plain error'} to ${outcome}`, () => {
        dispatchTodoError(error, outcomes);

        expect(outcomes[outcome]).toHaveBeenCalledOnceWith(error);
        Object.keys(outcomes).filter((name) => name !== outcome).forEach((name) => {
          expect(outcomes[name]).not.toHaveBeenCalled();
        });
      });
    });

    it('routes a session-expired rejection to onSessionExpired only', () => {
      dispatchTodoError(sessionExpiredError(), outcomes);

      expect(outcomes.onSessionExpired).toHaveBeenCalled();
      expect(outcomes.onError).not.toHaveBeenCalled();
    });

    it('ignores a session-expired rejection without an onSessionExpired callback', () => {
      const onError = jasmine.createSpy('onError');

      dispatchTodoError(sessionExpiredError(), { onError });

      expect(onError).not.toHaveBeenCalled();
    });

    it('falls back to onError when the matching callback is missing', () => {
      const onError = jasmine.createSpy('onError');
      const error = new ApiError(404, 'Not found');

      dispatchTodoError(error, { onError });

      expect(onError).toHaveBeenCalledWith(error);
    });

    it('treats another 409 as a generic error', () => {
      const error = new ApiError(409, 'conflict', 'OTHER');

      dispatchTodoError(error, outcomes);

      expect(outcomes.onError).toHaveBeenCalledWith(error);
    });
  });

  describe('fieldErrorsFromDetails', () => {
    it('groups the messages naming a field', () => {
      expect(fieldErrorsFromDetails(
        ['name should not be empty', 'name must be a string', 'property id should not exist'],
        ['name'],
      )).toEqual({
        fieldErrors: { name: 'name should not be empty; name must be a string' },
        rest: ['property id should not exist'],
      });
    });

    it('does not match a field name that is only a prefix of a word', () => {
      expect(fieldErrorsFromDetails(['names are bad'], ['name']))
        .toEqual({ fieldErrors: {}, rest: ['names are bad'] });
    });

    it('handles missing details', () => {
      expect(fieldErrorsFromDetails(undefined, ['name'])).toEqual({ fieldErrors: {}, rest: [] });
    });
  });

  it('exposes the list-has-items message', () => {
    expect(LIST_HAS_ITEMS_MESSAGE).toBe("Delete the list's items first");
  });
});
