import AccountEditFormHelper from '../../../../../../../assets/js/components/common/forms/helpers/AccountEditFormHelper.jsx';
import { itBehavesLikeAnAccountEditFormHelper } from '../../../../../../support/accountEditFormHelperExamples.js';
import { renderedOutput } from '../../../../../../support/renderedOutput.js';

describe('AccountEditFormHelper', () => {
  const buildOptions = (overrides = {}) => ({
    heading: 'Some Heading',
    successMessage: 'Saved it.',
    idPrefix: 'some-prefix-',
    ...overrides,
  });
  const Helper = {
    render: (state, handlers) => AccountEditFormHelper.render(state, handlers, buildOptions()),
  };
  const { buildHandlers, buildState } = itBehavesLikeAnAccountEditFormHelper({
    Helper,
    heading: 'Some Heading',
    successMessage: 'Saved it.',
    submitError: 'Boom',
    idPrefix: 'some-prefix-',
    changeFields: ['username', 'email', 'newPassword', 'newPasswordConfirmation'],
  });
  const leadingFields = [['currentPassword', 'password', 'Current password']];
  const render = (state = buildState(), handlers = buildHandlers(), options = buildOptions()) => (
    renderedOutput(AccountEditFormHelper.render(state, handlers, options))
  );

  describe('.render (form-specific)', () => {
    it('renders the change-password section', () => {
      const page = render();

      expect(page.containsTag('hr')).withContext('separator').toBeTrue();
      expect(page.containsElement('h2', 'Change password'))
        .withContext('change-password heading').toBeTrue();
    });

    it('wires exactly the profile and new-password fields to handlers.onChange(name)', () => {
      const handlers = buildHandlers();

      render(buildState(), handlers);

      expect(handlers.onChange.calls.allArgs().map(([name]) => name)).toEqual([
        'username', 'email', 'newPassword', 'newPasswordConfirmation',
      ]);
    });

    describe('without leadingPasswordFields', () => {
      it('renders no current-password field', () => {
        expect(render().contains('some-prefix-currentPassword'))
          .withContext('current-password field').toBeFalse();
      });
    });

    describe('with leadingPasswordFields', () => {
      const renderWithLeading = () => render(
        buildState(), buildHandlers(), buildOptions({ leadingPasswordFields: leadingFields }),
      );

      it('renders the leading field with the id prefix', () => {
        expect(renderWithLeading().containsAttribute('id', 'some-prefix-currentPassword'))
          .withContext('current-password input id').toBeTrue();
      });

      it('renders the leading field after the heading and before the new-password fields', () => {
        const page = renderWithLeading();

        expect(page.containsInOrder(
          'Change password', 'some-prefix-currentPassword', 'some-prefix-newPassword',
        )).withContext('field order').toBeTrue();
      });
    });
  });
});
