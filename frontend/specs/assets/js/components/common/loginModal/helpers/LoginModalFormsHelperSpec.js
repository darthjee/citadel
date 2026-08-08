import React from 'react';
import LoginModalFormsHelper from '../../../../../../../assets/js/components/common/loginModal/helpers/LoginModalFormsHelper.jsx';
import { renderedOutput } from '../../../../../../support/renderedOutput.js';

describe('LoginModalFormsHelper', () => {
  const buildHandlers = () => ({
    onSelectMode: jasmine.createSpy('onSelectMode'),
    onSubmit: jasmine.createSpy('onSubmit'),
    onUsernameChange: jasmine.createSpy('onUsernameChange'),
    onEmailChange: jasmine.createSpy('onEmailChange'),
    onPasswordChange: jasmine.createSpy('onPasswordChange'),
    onPasswordConfirmationChange: jasmine.createSpy('onPasswordConfirmationChange'),
  });

  const buildState = (overrides = {}) => ({
    mode: 'password',
    username: '',
    email: '',
    password: '',
    passwordConfirmation: '',
    fieldErrors: {},
    submitError: null,
    resultPanel: null,
    deviceExpiresAt: null,
    now: undefined,
    ...overrides,
  });

  const renderForms = (state, handlers = buildHandlers()) => renderedOutput(
    React.createElement('div', null, LoginModalFormsHelper.render(state, handlers)),
  );

  describe('.render', () => {
    ['Password', 'Register', 'Recover', 'Authorize with logged device'].forEach((label) => {
      it(`renders a ${label} selector button`, () => {
        const forms = renderForms(buildState());

        expect(forms.containsElement('button', label)).toBeTrue();
      });
    });

    it('renders a lone username field with the Send request label in device mode', () => {
      const forms = renderForms(buildState({ mode: 'device' }));

      expect(forms.contains('id="login-modal-username"')).withContext('username field').toBeTrue();
      expect(forms.contains('id="login-modal-password"')).withContext('password field').toBeFalse();
      expect(forms.contains('id="login-modal-email"')).withContext('email field').toBeFalse();
      expect(forms.containsElement('button', 'Send request'))
        .withContext('Send request button').toBeTrue();
    });

    it('invokes onSelectMode with device when the fourth selector button is clicked', () => {
      const handlers = buildHandlers();
      const tree = LoginModalFormsHelper.render(buildState(), handlers);
      const [selector] = tree.props.children;
      const deviceButton = selector.props.children.find((button) => button.key === 'device');

      deviceButton.props.onClick();

      expect(handlers.onSelectMode).toHaveBeenCalledWith('device');
    });

    it('marks the active mode button', () => {
      const forms = renderForms(buildState({ mode: 'register' }));

      expect(forms.contains('btn btn-outline-primary active')).toBeTrue();
    });

    it('renders only the username and password fields in password mode', () => {
      const forms = renderForms(buildState());

      expect(forms.contains('id="login-modal-username"')).withContext('username field').toBeTrue();
      expect(forms.contains('id="login-modal-password"')).withContext('password field').toBeTrue();
      expect(forms.contains('id="login-modal-email"')).withContext('email field').toBeFalse();
      expect(forms.contains('id="login-modal-passwordConfirmation"'))
        .withContext('password confirmation field').toBeFalse();
    });

    it('renders the full field set in register mode', () => {
      const forms = renderForms(buildState({ mode: 'register' }));

      expect(forms.contains('id="login-modal-email"')).withContext('email field').toBeTrue();
      expect(forms.contains('id="login-modal-passwordConfirmation"'))
        .withContext('password confirmation field').toBeTrue();
    });

    it('renders only the email field in recover mode', () => {
      const forms = renderForms(buildState({ mode: 'recover' }));

      expect(forms.contains('id="login-modal-email"')).withContext('email field').toBeTrue();
      expect(forms.contains('id="login-modal-username"')).withContext('username field').toBeFalse();
      expect(forms.contains('id="login-modal-password"')).withContext('password field').toBeFalse();
    });

    it('renders the two password fields in resetPassword mode', () => {
      const forms = renderForms(buildState({ mode: 'resetPassword' }));

      expect(forms.contains('id="login-modal-password"')).withContext('password field').toBeTrue();
      expect(forms.contains('id="login-modal-passwordConfirmation"'))
        .withContext('password confirmation field').toBeTrue();
      expect(forms.contains('id="login-modal-username"')).withContext('username field').toBeFalse();
      expect(forms.contains('id="login-modal-email"')).withContext('email field').toBeFalse();
    });

    it('falls back to the password field set for an unknown mode', () => {
      const forms = renderForms(buildState({ mode: 'mystery' }));

      expect(forms.contains('id="login-modal-username"')).withContext('username field').toBeTrue();
      expect(forms.contains('id="login-modal-password"')).withContext('password field').toBeTrue();
      expect(forms.contains('id="login-modal-email"')).withContext('email field').toBeFalse();
    });

    it('labels the submit button per mode', () => {
      expect(renderForms(buildState()).containsElement('button', 'Log in'))
        .withContext('password mode').toBeTrue();
      expect(renderForms(buildState({ mode: 'register' })).containsElement('button', 'Register'))
        .withContext('register mode').toBeTrue();
    });

    it('renders the submit error alert when present', () => {
      const forms = renderForms(buildState({ submitError: 'invalid credentials' }));

      expect(forms.contains('invalid credentials')).withContext('error message').toBeTrue();
      expect(forms.contains('alert-danger')).withContext('alert class').toBeTrue();
    });

    it('renders no alert when there is no submit error', () => {
      expect(renderForms(buildState()).contains('alert-danger')).toBeFalse();
    });

    it('renders an inline field error and the is-invalid class in register mode', () => {
      const forms = renderForms(buildState({
        mode: 'register',
        fieldErrors: { email: 'Email is invalid' },
      }));

      expect(forms.contains('Email is invalid')).withContext('field error').toBeTrue();
      expect(forms.contains('is-invalid')).withContext('is-invalid class').toBeTrue();
    });

    it('invokes onSelectMode with the clicked mode', () => {
      const handlers = buildHandlers();
      const tree = LoginModalFormsHelper.render(buildState(), handlers);
      const [selector] = tree.props.children;
      const registerButton = selector.props.children.find(
        (button) => button.key === 'register',
      );

      registerButton.props.onClick();

      expect(handlers.onSelectMode).toHaveBeenCalledWith('register');
    });
  });

  describe('.render result panels', () => {
    it('renders the neutral recover panel and no form or selector', () => {
      const forms = renderForms(buildState({ resultPanel: 'recover' }));

      expect(forms.contains('If that email matches an account, a reset link is on its way.'))
        .withContext('recover copy').toBeTrue();
      expect(forms.containsTag('form')).withContext('form tag').toBeFalse();
      expect(forms.contains('btn-outline-primary')).withContext('mode selector').toBeFalse();
    });

    it('renders the reset-password success panel with a back-to-log-in button', () => {
      const forms = renderForms(buildState({ resultPanel: 'resetPassword' }));

      expect(forms.contains('Your password has been updated.'))
        .withContext('success copy').toBeTrue();
      expect(forms.containsElement('button', 'Back to log in'))
        .withContext('Back to log in button').toBeTrue();
      expect(forms.containsTag('form')).withContext('form tag').toBeFalse();
    });

    it('routes the back-to-log-in button click through onSelectMode', () => {
      const handlers = buildHandlers();
      const tree = LoginModalFormsHelper.render(
        buildState({ resultPanel: 'resetPassword' }), handlers,
      );
      const [, button] = tree.props.children.props.children;

      button.props.onClick();

      expect(handlers.onSelectMode).toHaveBeenCalledWith('password');
    });
  });

  describe('.render device panels', () => {
    const waitingState = buildState({
      resultPanel: 'device:waiting',
      deviceExpiresAt: '2026-01-01T00:05:00.000Z',
      now: Date.parse('2026-01-01T00:00:00.000Z'),
    });

    it('renders the waiting panel with a spinner and an mm:ss countdown, no retry', () => {
      const forms = renderForms(waitingState);

      expect(forms.contains('Waiting for another device to approve'))
        .withContext('waiting copy').toBeTrue();
      expect(forms.contains('spinner-border')).withContext('spinner').toBeTrue();
      expect(forms.contains('05:00')).withContext('countdown').toBeTrue();
      expect(forms.containsElement('button', 'Try again'))
        .withContext('Try again button').toBeFalse();
      expect(forms.containsTag('form')).withContext('form tag').toBeFalse();
    });

    it('clamps the countdown at 00:00 once the expiry has passed', () => {
      const forms = renderForms(buildState({
        resultPanel: 'device:waiting',
        deviceExpiresAt: '2026-01-01T00:00:00.000Z',
        now: Date.parse('2026-01-01T00:05:00.000Z'),
      }));

      expect(forms.contains('00:00')).toBeTrue();
    });

    [
      ['device:denied', 'The request was denied on the other device.'],
      ['device:expired', 'The request expired before it was approved.'],
      ['device:logged', 'This login was already completed on another device.'],
      ['device:notFound', 'That request could not be found.'],
    ].forEach(([panel, copy]) => {
      it(`renders the ${panel} copy with a retry button`, () => {
        const forms = renderForms(buildState({ resultPanel: panel }));

        expect(forms.contains(copy)).withContext('panel copy').toBeTrue();
        expect(forms.containsElement('button', 'Try again'))
          .withContext('Try again button').toBeTrue();
        expect(forms.containsTag('form')).withContext('form tag').toBeFalse();
      });

      it(`routes the ${panel} retry button through onSelectMode('device')`, () => {
        const handlers = buildHandlers();
        const tree = LoginModalFormsHelper.render(buildState({ resultPanel: panel }), handlers);
        const [, button] = tree.props.children.props.children;

        button.props.onClick();

        expect(handlers.onSelectMode).toHaveBeenCalledWith('device');
      });
    });
  });
});
