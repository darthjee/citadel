import ApiError from '../../assets/js/client/ApiError.js';

const LONG_PASSWORD = 'longenough';

/**
 * Registers the `#validate` cases shared by every account edit form controller.
 *
 * @param {object} context - The shared context holding the spies (including `clientSpy`) and
 *   `buildController`.
 * @param {object} options - The options given to the example group.
 * @returns {void}
 */
const registerValidateExamples = (context, { blankFields }) => {
  describe('#validate', () => {
    it('returns no errors for a blank form', () => {
      const controller = context.buildController();

      expect(controller.validate(blankFields)).toEqual({});
    });

    it('flags a malformed email', () => {
      const controller = context.buildController();

      expect(
        controller.validate({ ...blankFields, email: 'not-an-email' }).email,
      ).toBeDefined();
    });

    it('accepts a blank email', () => {
      const controller = context.buildController();

      expect(controller.validate({ ...blankFields, email: '' }).email).toBeUndefined();
    });

    it('accepts a well-formed email', () => {
      const controller = context.buildController();

      expect(
        controller.validate({ ...blankFields, email: 'foo@example.com' }).email,
      ).toBeUndefined();
    });

    it('flags a new password shorter than 8 characters', () => {
      const controller = context.buildController();

      expect(
        controller.validate({
          ...blankFields, newPassword: 'short', newPasswordConfirmation: 'short',
        }).newPassword,
      ).toBeDefined();
    });

    it('flags a new password/confirmation mismatch', () => {
      const controller = context.buildController();

      expect(
        controller.validate({
          ...blankFields, newPassword: LONG_PASSWORD, newPasswordConfirmation: 'other',
        }).newPasswordConfirmation,
      ).toBeDefined();
    });

    it('accepts a matching, long-enough new password and confirmation', () => {
      const controller = context.buildController();

      expect(controller.validate({
        ...blankFields, newPassword: LONG_PASSWORD, newPasswordConfirmation: LONG_PASSWORD,
      })).toEqual({});
    });
  });
};

/**
 * Registers the `#handleSubmit` cases about which fields end up in the API payload.
 *
 * @param {object} context - The shared context holding the spies (including `clientSpy`) and
 *   `buildController`.
 * @param {object} options - The options given to the example group.
 * @returns {void}
 */
const registerPayloadExamples = (context, options) => {
  const { blankFields, submit, wrapResponse, expectedClientArgs } = options;

  const submitAndExpectPayload = async (response, fields, payload) => {
    context.clientSpy.and.resolveTo(wrapResponse(response));

    await submit(context.buildController(), fields);

    expect(context.clientSpy).toHaveBeenCalledWith(...expectedClientArgs(payload));
  };

  it('submits only the username when just the username changed', async () => {
    await submitAndExpectPayload(
      { username: 'newname', email: 'foo@example.com' },
      { ...blankFields, username: 'newname' },
      { username: 'newname' },
    );
  });

  it('submits only the email when just the email changed', async () => {
    await submitAndExpectPayload(
      { username: 'foo', email: 'new@example.com' },
      { ...blankFields, email: 'new@example.com' },
      { email: 'new@example.com' },
    );
  });

  it('submits only the new password when just the password changed', async () => {
    await submitAndExpectPayload(
      { username: 'foo', email: 'foo@example.com' },
      { ...blankFields, newPassword: LONG_PASSWORD, newPasswordConfirmation: LONG_PASSWORD },
      { newPassword: LONG_PASSWORD },
    );
  });

  it('submits every changed field together', async () => {
    await submitAndExpectPayload(
      { username: 'newname', email: 'new@example.com' },
      {
        ...blankFields,
        username: 'newname',
        email: 'new@example.com',
        newPassword: LONG_PASSWORD,
        newPasswordConfirmation: LONG_PASSWORD,
      },
      { username: 'newname', email: 'new@example.com', newPassword: LONG_PASSWORD },
    );
  });
};

/**
 * Registers the `#handleSubmit` cases about the outcome (success, errors, expired session).
 *
 * @param {object} context - The shared context holding the spies (including `clientSpy`) and
 *   `buildController`.
 * @param {object} options - The options given to the example group.
 * @returns {void}
 */
const registerOutcomeExamples = (context, options) => {
  const { blankFields, submit, wrapResponse } = options;

  it('reflects the response username/email, clears the new password fields, and flags success', async () => {
    context.clientSpy.and.resolveTo(
      wrapResponse({ username: 'newname', email: 'foo@example.com' }),
    );

    await submit(context.buildController(), { ...blankFields, username: 'newname' });

    const updater = context.setFields.calls.mostRecent().args[0];
    expect(updater({ username: 'old', email: 'foo@example.com' })).toEqual(
      jasmine.objectContaining({
        username: 'newname',
        email: 'foo@example.com',
        newPassword: '',
        newPasswordConfirmation: '',
      }),
    );
    expect(context.setSuccess).toHaveBeenCalledWith(true);
  });

  [
    ['a duplicate username', 'Username already in use', { username: 'taken' }],
    ['a duplicate email', 'Email already in use', { email: 'taken@example.com' }],
    [
      'a password too short',
      'Password too short',
      { newPassword: LONG_PASSWORD, newPasswordConfirmation: LONG_PASSWORD },
    ],
  ].forEach(([description, message, changes]) => {
    it(`stores the submit error on ${description}`, async () => {
      context.clientSpy.and.rejectWith(new ApiError(400, message));

      await submit(context.buildController(), { ...blankFields, ...changes });

      expect(context.setSubmitError).toHaveBeenCalledWith(message);
    });
  });

  it('does nothing further when the session turned out to be expired', async () => {
    context.clientSpy.and.resolveTo(undefined);

    await submit(context.buildController(), { ...blankFields, username: 'newname' });

    expect(context.setFields).not.toHaveBeenCalled();
    expect(context.setSuccess).not.toHaveBeenCalledWith(true);
  });
};

/**
 * Registers the `#handleSubmit` cases for the paths that never reach the API.
 *
 * @param {object} context - The shared context holding the spies (including `clientSpy`) and
 *   `buildController`.
 * @param {object} options - The options given to the example group.
 * @returns {void}
 */
const registerSkippedCallExamples = (context, options) => {
  const { blankFields, submit } = options;

  it('sets field errors and skips the API call when the form is invalid', async () => {
    await submit(context.buildController(), { ...blankFields, email: 'not-an-email' });

    expect(context.setFieldErrors).toHaveBeenCalledWith(
      jasmine.objectContaining({ email: jasmine.any(String) }),
    );
    expect(context.clientSpy).not.toHaveBeenCalled();
  });

  it('sets a submit error and skips the API call when no field was actually filled in', async () => {
    await submit(context.buildController(), blankFields);

    expect(context.setFieldErrors).toHaveBeenCalledWith({});
    expect(context.setSubmitError).toHaveBeenCalledWith(jasmine.any(String));
    expect(context.clientSpy).not.toHaveBeenCalled();
  });
};

/**
 * Registers the behaviour shared by every controller extending `AccountEditFormController`.
 *
 * Must be called inside a `describe`. It registers a `beforeEach` that (re)creates the spies
 * on the returned context, so the calling spec can reuse them for its own specific cases.
 *
 * @param {object} options - How the shared cases must talk to the controller under test.
 * @param {Function} options.ControllerClass - The controller class under test.
 * @param {string} options.clientMethod - The name of the client method the controller calls.
 * @param {object} options.blankFields - The blank form, including any controller-only field.
 * @param {Function} options.submit - `(controller, fields)` adapter around `handleSubmit`.
 * @param {Function} options.wrapResponse - Wraps an account into the client's response shape.
 * @param {Function} options.expectedClientArgs - Maps a payload to the expected client args.
 * @returns {object} The context, whose spies are refreshed before every example (`clientSpy`
 *   is the spy for `clientMethod`, also exposed under its real name on `client`), plus
 *   `buildController()` to create a controller wired to them.
 */
export const itBehavesLikeAnAccountEditFormController = (options) => {
  const { ControllerClass, clientMethod } = options;
  const context = {};

  context.buildController = () => new ControllerClass(
    context.setFields,
    context.setFieldErrors,
    context.setSubmitError,
    context.setSuccess,
    context.client,
  );

  beforeEach(() => {
    context.setFields = jasmine.createSpy('setFields');
    context.setFieldErrors = jasmine.createSpy('setFieldErrors');
    context.setSubmitError = jasmine.createSpy('setSubmitError');
    context.setSuccess = jasmine.createSpy('setSuccess');
    context.clientSpy = jasmine.createSpy(clientMethod);
    context.client = Object.fromEntries([[clientMethod, context.clientSpy]]);
  });

  registerValidateExamples(context, options);

  describe('#handleSubmit', () => {
    registerSkippedCallExamples(context, options);
    registerPayloadExamples(context, options);
    registerOutcomeExamples(context, options);
  });

  return context;
};
