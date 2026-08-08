import { useMemo, useState } from 'react';
import LoginModalController from './controllers/LoginModalController.js';
import LoginModalHelper from './helpers/LoginModalHelper.jsx';
import useLoginModal from './hooks/useLoginModal.js';
import useDeviceCountdown from './hooks/useDeviceCountdown.js';
import LoginModalEvents from '../../../client/LoginModalEvents.js';

const INITIAL_FIELDS = {
  username: '', email: '', password: '', passwordConfirmation: '',
};

/**
 * Route-independent login modal. Opened via the shared {@link LoginModalEvents} bus — from the
 * header or from `ApiClient`'s session-expired handling — in Password, Register, Recover,
 * Set-new-password, or Authorize-with-logged-device mode, and closed the same way. Password /
 * Register — and an approved device authorization — converge on the {@link LoginModalController}
 * success path, which closes the modal and redirects home. Recover and Set-new-password instead
 * leave the modal open on a neutral / success result panel; device mode shows a waiting-with-
 * countdown panel driven by a 1s ticker, then its own terminal panel.
 *
 * @returns {React.ReactElement} The rendered modal (nothing visible while closed).
 */
export default function LoginModal() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('password');
  const [fields, setFields] = useState(INITIAL_FIELDS);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [resetToken, setResetToken] = useState('');
  const [resultPanel, setResultPanel] = useState(null);
  const [deviceExpiresAt, setDeviceExpiresAt] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  const controller = useMemo(
    () => new LoginModalController(
      setMode, setFields, setFieldErrors, setSubmitError, setResultPanel, setDeviceExpiresAt,
    ),
    [],
  );
  const setters = useMemo(() => ({ setOpen, setResetToken, setResultPanel }), []);

  useLoginModal(controller, setters);
  useDeviceCountdown(resultPanel, setNow);

  const handleFieldChange = (field) => (event) => {
    const { value } = event.target;
    setFields((current) => ({ ...current, [field]: value }));
  };

  const handleSelectMode = (nextMode) => {
    setResultPanel(null);
    setResetToken('');
    controller.switchMode(nextMode);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    return controller.handleSubmit(mode, fields, resetToken);
  };

  return LoginModalHelper.render(
    {
      ...fields, open, mode, fieldErrors, submitError, resultPanel, deviceExpiresAt, now,
    },
    {
      onClose: () => LoginModalEvents.close(),
      onSelectMode: handleSelectMode,
      onSubmit: handleSubmit,
      onUsernameChange: handleFieldChange('username'),
      onEmailChange: handleFieldChange('email'),
      onPasswordChange: handleFieldChange('password'),
      onPasswordConfirmationChange: handleFieldChange('passwordConfirmation'),
    },
  );
}
