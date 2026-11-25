import FormFieldsHelper from '../../../../common/forms/helpers/FormFieldsHelper.jsx';

/**
 * Shared rendering helper for the organization name forms (create and rename).
 */
const OrganizationFormHelper = {
  /**
   * Render a name form page.
   *
   * @param {{name: string, fieldErrors: object, submitError: (string|null), pending: boolean}}
   *   state - Form state.
   * @param {{onSubmit: Function, onChange: Function}} handlers - Event handlers; `onChange`
   *   handles the name field.
   * @param {{heading: string, submitLabel: string, idPrefix: string}} options - Page heading,
   *   submit button label and input-id prefix.
   * @returns {React.ReactElement} The rendered form page.
   */
  render(state, handlers, { heading, submitLabel, idPrefix }) {
    return (
      <div className="container mt-4">
        <h1>{heading}</h1>
        <form onSubmit={handlers.onSubmit} noValidate>
          {FormFieldsHelper.renderSubmitError(state)}
          {FormFieldsHelper.renderField('name', 'text', 'Name', state, handlers.onChange, idPrefix)}
          <button type="submit" className="btn btn-primary" disabled={state.pending}>{submitLabel}</button>
        </form>
      </div>
    );
  },
};

export default OrganizationFormHelper;
