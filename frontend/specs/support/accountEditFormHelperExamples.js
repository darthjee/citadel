import { renderedOutput } from './renderedOutput.js';

const ID_FIELDS = ['username', 'email', 'newPassword', 'newPasswordConfirmation'];

/**
 * Builds the `{ onSubmit, onChange }` handlers, both spies, `onChange` returning a spy.
 *
 * @returns {{onSubmit: jasmine.Spy, onChange: jasmine.Spy}} The spy handlers.
 */
const buildHandlers = () => ({
  onSubmit: jasmine.createSpy('onSubmit'),
  onChange: jasmine.createSpy('onChange').and.returnValue(jasmine.createSpy('handler')),
});

/**
 * Builds a blank page state, including `currentPassword`, with the given overrides applied.
 *
 * @param {object} [overrides] - State attributes overriding the blank defaults.
 * @returns {object} The page state.
 */
const buildState = (overrides = {}) => ({
  username: '',
  email: '',
  currentPassword: '',
  newPassword: '',
  newPasswordConfirmation: '',
  fieldErrors: {},
  submitError: null,
  success: false,
  ...overrides,
});

/**
 * Registers the cases about the page heading, the form and the input ids.
 *
 * @param {Function} renderPage - `(state, handlers)` returning the `renderedOutput` of the render.
 * @param {object} options - The options given to the example group.
 * @returns {void}
 */
const registerStructureExamples = (renderPage, { heading, idPrefix }) => {
  it('renders the page heading', () => {
    const page = renderPage(buildState(), buildHandlers());

    expect(page.contains(heading)).withContext('page heading').toBeTrue();
  });

  it('wires the form submission to the submit handler', () => {
    const page = renderPage(buildState(), buildHandlers());

    expect(page.containsTag('form')).withContext('form tag').toBeTrue();
    expect(page.contains('>Save<')).withContext('Save button').toBeTrue();
  });

  ID_FIELDS.forEach((name) => {
    it(`gives the ${name} input the id prefixed with ${idPrefix}`, () => {
      const page = renderPage(buildState(), buildHandlers());

      expect(page.contains(`id="${idPrefix}${name}"`)).withContext(`${name} input id`).toBeTrue();
    });
  });
};

/**
 * Registers the cases about the submit-time error alert and the success confirmation.
 *
 * @param {Function} renderPage - `(state, handlers)` returning the `renderedOutput` of the render.
 * @param {object} options - The options given to the example group.
 * @returns {void}
 */
const registerAlertExamples = (renderPage, { successMessage, submitError }) => {
  it('renders the submit-time error alert when present', () => {
    const page = renderPage(buildState({ submitError }), buildHandlers());

    expect(page.contains(submitError)).withContext('submit error text').toBeTrue();
    expect(page.contains('alert-danger')).withContext('danger alert').toBeTrue();
  });

  it('renders no submit-error alert when there is none', () => {
    const page = renderPage(buildState(), buildHandlers());

    expect(page.contains('alert-danger')).withContext('danger alert').toBeFalse();
  });

  it('renders a success confirmation once the save succeeded', () => {
    const page = renderPage(buildState({ success: true }), buildHandlers());

    expect(page.contains('alert-success')).withContext('success alert').toBeTrue();
    expect(page.contains(successMessage)).withContext('success message').toBeTrue();
  });

  it('renders no success confirmation before a save', () => {
    const page = renderPage(buildState(), buildHandlers());

    expect(page.contains('alert-success')).withContext('success alert').toBeFalse();
  });
};

/**
 * Registers the cases about field values, inline errors and change handlers.
 *
 * @param {Function} renderPage - `(state, handlers)` returning the `renderedOutput` of the render.
 * @param {object} options - The options given to the example group.
 * @returns {void}
 */
const registerFieldExamples = (renderPage, { changeFields }) => {
  it('renders the current field values', () => {
    const page = renderPage(
      buildState({ username: 'foo', email: 'foo@example.com' }),
      buildHandlers(),
    );

    expect(page.contains('value="foo"')).withContext('username value').toBeTrue();
    expect(page.contains('value="foo@example.com"')).withContext('email value').toBeTrue();
  });

  it('renders an inline error for an invalid field', () => {
    const page = renderPage(
      buildState({ fieldErrors: { email: 'Email is invalid' } }),
      buildHandlers(),
    );

    expect(page.contains('Email is invalid')).withContext('inline error text').toBeTrue();
    expect(page.contains('is-invalid')).withContext('invalid field class').toBeTrue();
  });

  it('renders no inline error for a field with no recorded error', () => {
    const page = renderPage(buildState(), buildHandlers());

    expect(page.contains('is-invalid')).withContext('invalid field class').toBeFalse();
  });

  it('wires each field\'s change handler with its own field name', () => {
    const handlers = buildHandlers();
    renderPage(buildState(), handlers);

    changeFields.forEach((name) => {
      expect(handlers.onChange).toHaveBeenCalledWith(name);
    });
  });
};

/**
 * Registers the rendering behaviour shared by every helper built on `AccountEditFormHelper`.
 *
 * Must be called inside a `describe`. It registers a `describe('.render')` block with the
 * shared cases and returns the builders so the calling spec can reuse them for its own cases.
 *
 * @param {object} options - How the shared cases must talk to the helper under test.
 * @param {Function} options.Helper - The helper class under test (exposing `render`).
 * @param {string} options.heading - The page heading the helper renders.
 * @param {string} options.successMessage - The success confirmation the helper renders.
 * @param {string} options.submitError - Text used for the submit-error alert case.
 * @param {string} options.idPrefix - The prefix of the input ids (e.g. `my-account-`).
 * @param {string[]} options.changeFields - The field names the change handler is wired with.
 * @returns {{buildHandlers: Function, buildState: Function, renderPage: Function}} The
 *   `buildHandlers()` and `buildState(overrides)` builders, plus `renderPage(state, handlers)`
 *   returning the `renderedOutput` of `Helper.render(state, handlers)`.
 */
export const itBehavesLikeAnAccountEditFormHelper = (options) => {
  const { Helper } = options;
  const renderPage = (state, handlers) => renderedOutput(Helper.render(state, handlers));

  describe('.render', () => {
    registerStructureExamples(renderPage, options);
    registerAlertExamples(renderPage, options);
    registerFieldExamples(renderPage, options);
  });

  return { buildHandlers, buildState, renderPage };
};
