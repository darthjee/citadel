import React from 'react';
import Modal from 'react-bootstrap/cjs/Modal.js';
import LoginModalHelper from '../../../../../../../assets/js/components/common/loginModal/helpers/LoginModalHelper.jsx';
import LoginModalFormsHelper from '../../../../../../../assets/js/components/common/loginModal/helpers/LoginModalFormsHelper.jsx';

describe('LoginModalHelper', () => {
  const buildHandlers = () => ({ onClose: jasmine.createSpy('onClose') });
  const buildState = (overrides = {}) => ({ open: true, mode: 'password', ...overrides });

  const findTitle = (element) => {
    const [header] = element.props.children;
    return header.props.children.props.children;
  };

  beforeEach(() => {
    spyOn(LoginModalFormsHelper, 'render').and.returnValue(React.createElement('div', null, 'forms'));
  });

  describe('.render', () => {
    it('renders a react-bootstrap Modal', () => {
      const element = LoginModalHelper.render(buildState(), buildHandlers());

      expect(element.type).toBe(Modal);
    });

    it('drives the Modal open state from state.open', () => {
      expect(LoginModalHelper.render(buildState({ open: true }), buildHandlers()).props.show).toBe(true);
      expect(LoginModalHelper.render(buildState({ open: false }), buildHandlers()).props.show).toBe(false);
    });

    it('wires the close handler to the Modal onHide', () => {
      const handlers = buildHandlers();

      const element = LoginModalHelper.render(buildState(), handlers);

      expect(element.props.onHide).toBe(handlers.onClose);
    });

    it('delegates the body to LoginModalFormsHelper with the same state and handlers', () => {
      const state = buildState();
      const handlers = buildHandlers();

      LoginModalHelper.render(state, handlers);

      expect(LoginModalFormsHelper.render).toHaveBeenCalledWith(state, handlers);
    });

    it('titles the modal per mode', () => {
      const passwordTitle = findTitle(LoginModalHelper.render(buildState({ mode: 'password' }), buildHandlers()));
      const registerTitle = findTitle(LoginModalHelper.render(buildState({ mode: 'register' }), buildHandlers()));

      expect(passwordTitle).toBe('Log in');
      expect(registerTitle).toBe('Create an account');
    });

    it('titles the modal for the recover and resetPassword modes', () => {
      const recoverTitle = findTitle(LoginModalHelper.render(buildState({ mode: 'recover' }), buildHandlers()));
      const resetTitle = findTitle(LoginModalHelper.render(buildState({ mode: 'resetPassword' }), buildHandlers()));

      expect(recoverTitle).toBe('Recover password');
      expect(resetTitle).toBe('Set a new password');
    });

    it('titles the modal for the device mode', () => {
      const deviceTitle = findTitle(LoginModalHelper.render(buildState({ mode: 'device' }), buildHandlers()));

      expect(deviceTitle).toBe('Authorize with logged device');
    });

    it('falls back to the password title for an unknown mode', () => {
      const title = findTitle(LoginModalHelper.render(buildState({ mode: 'mystery' }), buildHandlers()));

      expect(title).toBe('Log in');
    });
  });
});
