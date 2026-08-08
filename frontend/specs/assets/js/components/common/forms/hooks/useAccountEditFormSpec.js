import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import useAccountEditForm from '../../../../../../../assets/js/components/common/forms/hooks/useAccountEditForm.js';

describe('useAccountEditForm', () => {
  let initialFields;
  let controller;
  let createController;
  let submit;
  let captured;

  const renderHook = () => {
    const Probe = () => {
      captured = useAccountEditForm({ initialFields, createController, submit });
      return null;
    };

    renderToStaticMarkup(createElement(Probe));
  };

  beforeEach(() => {
    initialFields = { username: 'alice', email: 'alice@example.com' };
    controller = { handleSubmit: jasmine.createSpy('handleSubmit') };
    createController = jasmine.createSpy('createController').and.returnValue(controller);
    submit = jasmine.createSpy('submit').and.returnValue('submit-result');
    captured = undefined;
  });

  it('returns the initial fields together with the empty error/success state', () => {
    renderHook();

    expect(captured.state).toEqual({
      username: 'alice',
      email: 'alice@example.com',
      fieldErrors: {},
      submitError: null,
      success: false,
    });
  });

  it('builds the controller once with the four state setters', () => {
    renderHook();

    expect(createController).toHaveBeenCalledTimes(1);
    expect(createController).toHaveBeenCalledWith(
      jasmine.any(Function),
      jasmine.any(Function),
      jasmine.any(Function),
      jasmine.any(Function),
    );
  });

  it('exposes onSubmit and onChange handlers', () => {
    renderHook();

    expect(captured.handlers.onSubmit).toEqual(jasmine.any(Function));
    expect(captured.handlers.onChange).toEqual(jasmine.any(Function));
  });

  describe('onChange', () => {
    it('returns a change handler that does not throw and does not submit', () => {
      renderHook();
      const handler = captured.handlers.onChange('username');

      expect(() => handler({ target: { value: 'bob' } })).not.toThrow();
      expect(submit).not.toHaveBeenCalled();
    });
  });

  describe('onSubmit', () => {
    let event;

    beforeEach(() => {
      event = { preventDefault: jasmine.createSpy('preventDefault') };
    });

    it('prevents the default form submission', () => {
      renderHook();

      captured.handlers.onSubmit(event);

      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('calls submit with the controller and the current fields', () => {
      renderHook();

      captured.handlers.onSubmit(event);

      expect(submit).toHaveBeenCalledWith(controller, initialFields);
    });

    it('returns the result of submit', () => {
      renderHook();

      expect(captured.handlers.onSubmit(event)).toEqual('submit-result');
    });
  });
});
