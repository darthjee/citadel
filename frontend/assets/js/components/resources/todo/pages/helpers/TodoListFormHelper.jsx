import FormFieldsHelper from '../../../../common/forms/helpers/FormFieldsHelper.jsx';

/**
 * Shared rendering helper for the todo list name forms (create and rename).
 */
const TodoListFormHelper = {
  /**
   * Render a list name form page.
   *
   * @param {{name: string, fieldErrors: object, submitError: (string|null), pending: boolean}}
   *   state - Form state.
   * @param {{onSubmit: Function, onChange: Function}} handlers - Event handlers; `onChange`
   *   handles the name field.
   * @param {{heading: string, submitLabel: string, idPrefix: string, cancelHref: string}}
   *   options - Page heading, submit button label, input-id prefix and the Cancel link target.
   * @returns {React.ReactElement} The rendered form page.
   */
  render(state, handlers, {
    heading, submitLabel, idPrefix, cancelHref,
  }) {
    return (
      <div className="container mt-4">
        <h1>{heading}</h1>
        <form onSubmit={handlers.onSubmit} noValidate>
          {FormFieldsHelper.renderSubmitError(state)}
          {FormFieldsHelper.renderField('name', 'text', 'Name', state, handlers.onChange, idPrefix)}
          <button type="submit" className="btn btn-primary me-2" disabled={state.pending}>{submitLabel}</button>
          <a className="btn btn-outline-secondary" href={cancelHref}>Cancel</a>
        </form>
      </div>
    );
  },
};

export default TodoListFormHelper;
