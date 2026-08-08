import FormFieldsHelper from '../../../../../../../assets/js/components/common/forms/helpers/FormFieldsHelper.jsx';
import { renderedOutput } from '../../../../../../support/renderedOutput.js';

describe('FormFieldsHelper', () => {
  describe('.renderField', () => {
    const render = (state, onChange = jasmine.createSpy('onChange')) => renderedOutput(
      FormFieldsHelper.renderField('username', 'text', 'Username', state, onChange, 'my-prefix-'),
    );

    it('renders the label, prefixed id, type and current value', () => {
      const field = render({ username: 'foo', fieldErrors: {} });

      expect(field.containsAttribute('for', 'my-prefix-username')).withContext('label for').toBeTrue();
      expect(field.containsAttribute('id', 'my-prefix-username')).withContext('input id').toBeTrue();
      expect(field.containsAttribute('type', 'text')).withContext('input type').toBeTrue();
      expect(field.containsAttribute('value', 'foo')).withContext('input value').toBeTrue();
      expect(field.containsElement('label', 'Username')).withContext('label text').toBeTrue();
    });

    it('marks the field invalid and shows the error when one is present', () => {
      const field = render({ username: '', fieldErrors: { username: 'is required' } });

      expect(field.contains('is-invalid')).withContext('invalid class').toBeTrue();
      expect(field.containsAttribute('class', 'invalid-feedback'))
        .withContext('feedback class').toBeTrue();
      expect(field.containsElement('div', 'is required')).withContext('feedback text').toBeTrue();
    });

    it('renders no error markup when there is no error for the field', () => {
      const field = render({ username: '', fieldErrors: { email: 'bad' } });

      expect(field.contains('is-invalid')).withContext('invalid class').toBeFalse();
      expect(field.contains('invalid-feedback')).withContext('feedback').toBeFalse();
    });

    it('tolerates a missing fieldErrors object', () => {
      const field = render({ username: '' });

      expect(field.contains('invalid-feedback')).withContext('feedback').toBeFalse();
    });

    it('keys the wrapper by the field name and wires the given onChange', () => {
      const onChange = jasmine.createSpy('onChange');
      const element = FormFieldsHelper.renderField(
        'username', 'text', 'Username', { username: '' }, onChange, 'p-',
      );

      expect(element.key).toBe('username');
      expect(element.props.children[1].props.onChange).toBe(onChange);
    });
  });

  describe('.renderSubmitError', () => {
    it('renders the danger alert with the error message', () => {
      const alert = renderedOutput(FormFieldsHelper.renderSubmitError({ submitError: 'Boom' }));

      expect(alert.containsAttribute('class', 'alert alert-danger'))
        .withContext('danger alert class').toBeTrue();
      expect(alert.containsElement('div', 'Boom')).withContext('alert text').toBeTrue();
    });

    it('returns null when there is no submit error', () => {
      expect(FormFieldsHelper.renderSubmitError({ submitError: null })).toBeNull();
    });
  });

  describe('.renderSuccess', () => {
    it('renders the success alert with the given message', () => {
      const alert = renderedOutput(FormFieldsHelper.renderSuccess({ success: true }, 'Saved.'));

      expect(alert.containsAttribute('class', 'alert alert-success'))
        .withContext('success alert class').toBeTrue();
      expect(alert.containsElement('div', 'Saved.')).withContext('alert text').toBeTrue();
    });

    it('returns null when the save has not succeeded', () => {
      expect(FormFieldsHelper.renderSuccess({ success: false }, 'Saved.')).toBeNull();
    });
  });
});
