import AuthorizationRequestsHelper from '../../../../../../../../assets/js/components/resources/accounts/pages/helpers/AuthorizationRequestsHelper.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('AuthorizationRequestsHelper', () => {
  const buildHandlers = () => ({
    onToggleAuthorize: jasmine.createSpy('onToggleAuthorize').and.returnValue(jasmine.createSpy('handler')),
    onPasswordChange: jasmine.createSpy('onPasswordChange').and.returnValue(jasmine.createSpy('handler')),
    onConfirmAuthorize: jasmine.createSpy('onConfirmAuthorize').and.returnValue(jasmine.createSpy('handler')),
    onDeny: jasmine.createSpy('onDeny').and.returnValue(jasmine.createSpy('handler')),
  });
  const buildState = (overrides = {}) => ({
    requests: [],
    loadError: null,
    rowState: new Map(),
    ...overrides,
  });

  const renderPage = (state, handlers = buildHandlers()) => renderedOutput(
    AuthorizationRequestsHelper.render(state, handlers),
  );

  describe('.render', () => {
    it('renders the page heading', () => {
      const page = renderPage(buildState());

      expect(page.contains('Authorization Requests')).toBeTrue();
    });

    it('renders the load error alert when present', () => {
      const page = renderPage(buildState({ loadError: 'network error' }));

      expect(page.contains('network error')).withContext('error message').toBeTrue();
      expect(page.contains('alert-danger')).withContext('alert class').toBeTrue();
    });

    it('renders no alert when there is no load error', () => {
      const page = renderPage(buildState());

      expect(page.contains('alert-danger')).toBeFalse();
    });

    it('renders an empty-state message when there are no requests', () => {
      const page = renderPage(buildState());

      expect(page.contains('No pending authorization requests.')).toBeTrue();
    });

    describe('with open requests', () => {
      const requests = [{
        uuid: 'req-uuid',
        requestIp: '127.0.0.1',
        requestUserAgent: 'Mozilla/5.0',
        createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
      }];

      it('renders a row per request with its IP, User-Agent and age', () => {
        const page = renderPage(buildState({ requests }));

        expect(page.contains('127.0.0.1')).withContext('IP').toBeTrue();
        expect(page.contains('Mozilla/5.0')).withContext('User-Agent').toBeTrue();
        expect(page.contains('5 min ago')).withContext('age').toBeTrue();
      });

      it('renders "just now" for a request under a minute old', () => {
        const freshRequests = [{ ...requests[0], createdAt: new Date().toISOString() }];
        const page = renderPage(buildState({ requests: freshRequests }));

        expect(page.contains('just now')).toBeTrue();
      });

      it('renders Deny and Authorize actions', () => {
        const page = renderPage(buildState({ requests }));

        expect(page.contains('Deny')).withContext('Deny action').toBeTrue();
        expect(page.contains('Authorize')).withContext('Authorize action').toBeTrue();
        expect(page.contains('Confirm')).withContext('Confirm action').toBeFalse();
      });

      it('wires the deny and authorize-toggle handlers with the request uuid', () => {
        const handlers = buildHandlers();
        renderPage(buildState({ requests }), handlers);

        expect(handlers.onDeny).toHaveBeenCalledWith('req-uuid');
        expect(handlers.onToggleAuthorize).toHaveBeenCalledWith('req-uuid');
      });

      it('renders an inline password field and Confirm button once toggled open', () => {
        const rowState = new Map([['req-uuid', { open: true, password: '' }]]);
        const page = renderPage(buildState({ requests, rowState }));

        expect(page.containsAttribute('type', 'password')).withContext('password field').toBeTrue();
        expect(page.contains('Confirm')).withContext('Confirm button').toBeTrue();
        expect(page.containsElement('button', 'Authorize')).withContext('Authorize toggle').toBeFalse();
      });

      it('wires the password-change and confirm-authorize handlers with the request uuid', () => {
        const rowState = new Map([['req-uuid', { open: true, password: '' }]]);
        const handlers = buildHandlers();
        renderPage(buildState({ requests, rowState }), handlers);

        expect(handlers.onPasswordChange).toHaveBeenCalledWith('req-uuid');
        expect(handlers.onConfirmAuthorize).toHaveBeenCalledWith('req-uuid');
      });

      it('renders a row-level error message', () => {
        const rowState = new Map([['req-uuid', { error: 'Invalid password' }]]);
        const page = renderPage(buildState({ requests, rowState }));

        expect(page.contains('Invalid password')).toBeTrue();
      });

      it('renders nothing extra for a row with no recorded state', () => {
        const page = renderPage(buildState({ requests }));

        expect(page.contains('text-danger')).toBeFalse();
      });
    });
  });
});
