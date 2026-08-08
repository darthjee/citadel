import { useMemo, useState } from 'react';

/**
 * Shared state and handlers for the account-edit form pages (`MyAccount`, `AdminUserEdit`).
 * Keeps `fields`/`fieldErrors`/`submitError`/`success` in React state, builds the page's
 * controller once from the four state setters, and exposes the `onChange`/`onSubmit` handlers
 * plus the combined `state`, ready to pass to `AccountEditFormHelper`-based renderers
 * (`Helper.render(state, handlers)`).
 *
 * @param {object} options - Hook options.
 * @param {object} options.initialFields - Initial values for the editable form fields.
 * @param {Function} options.createController - Factory called once as
 *   `createController(setFields, setFieldErrors, setSubmitError, setSuccess)` that returns the
 *   page's controller.
 * @param {Function} options.submit - Per-page adapter called on submit as
 *   `submit(controller, fields)`; it must invoke the controller's own `handleSubmit`.
 * @returns {{state: object, handlers: {onSubmit: Function, onChange: Function}}} The form state
 *   (the fields spread together with `fieldErrors`, `submitError` and `success`) and the
 *   `onSubmit`/`onChange` handlers.
 */
export default function useAccountEditForm({ initialFields, createController, submit }) {
  const [fields, setFields] = useState(initialFields);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [success, setSuccess] = useState(false);

  // The controller is built once per mount; the factory is not expected to change.
  const controller = useMemo(
    () => createController(setFields, setFieldErrors, setSubmitError, setSuccess),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const onChange = (field) => (event) => {
    const { value } = event.target;
    setFields((current) => ({ ...current, [field]: value }));
  };

  const onSubmit = (event) => {
    event.preventDefault();
    return submit(controller, fields);
  };

  return {
    state: {
      ...fields, fieldErrors, submitError, success,
    },
    handlers: { onSubmit, onChange },
  };
}
