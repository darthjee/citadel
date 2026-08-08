import AuthorizationRequestPoller, {
  buildPollTick,
} from '../../../../../assets/js/utils/polling/AuthorizationRequestPoller.js';
import { flushMicrotasks as flush } from '../../../../support/flushMicrotasks.js';

describe('AuthorizationRequestPoller', () => {
  const NOW = new Date('2026-09-09T00:00:00.000Z');
  const FUTURE = '2026-09-09T00:30:00.000Z';

  let client;
  let onApproved;
  let onRejected;
  let onTick;

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(NOW);
    client = jasmine.createSpyObj('client', ['pollAuthorizationRequest']);
    onApproved = jasmine.createSpy('onApproved');
    onRejected = jasmine.createSpy('onRejected');
    onTick = jasmine.createSpy('onTick');
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  /**
   * Build a poller wired to the shared spies.
   *
   * @param {object} overrides - Constructor option overrides.
   * @returns {AuthorizationRequestPoller} The poller under test.
   */
  function buildPoller(overrides = {}) {
    return new AuthorizationRequestPoller({
      uuid: 'req-uuid',
      pollToken: 'poll-token',
      expiresAt: FUTURE,
      client,
      intervalMs: 5000,
      onApproved,
      onRejected,
      onTick,
      ...overrides,
    });
  }

  it('polls after one interval and reschedules while the status stays open', async () => {
    client.pollAuthorizationRequest.and.resolveTo({ status: 'open' });
    buildPoller().start();

    jasmine.clock().tick(5000);
    await flush();

    expect(client.pollAuthorizationRequest).toHaveBeenCalledWith('req-uuid', 'poll-token');
    expect(client.pollAuthorizationRequest).toHaveBeenCalledTimes(1);
    expect(onTick).toHaveBeenCalledTimes(1);

    jasmine.clock().tick(5000);
    await flush();

    expect(client.pollAuthorizationRequest).toHaveBeenCalledTimes(2);
    expect(onTick).toHaveBeenCalledTimes(2);
  });

  it('fires onApproved with the result and stops polling on approved', async () => {
    const result = {
      status: 'approved',
      user: { id: 1, username: 'foo', email: 'foo@example.com', isAdmin: false },
      refreshToken: 'refresh-token',
    };
    client.pollAuthorizationRequest.and.resolveTo(result);
    buildPoller().start();

    jasmine.clock().tick(5000);
    await flush();

    expect(onApproved).toHaveBeenCalledOnceWith(result);
    expect(onRejected).not.toHaveBeenCalled();

    jasmine.clock().tick(30000);
    await flush();

    expect(client.pollAuthorizationRequest).toHaveBeenCalledTimes(1);
    expect(onApproved).toHaveBeenCalledTimes(1);
  });

  ['denied', 'expired', 'logged'].forEach((status) => {
    it(`fires onRejected('${status}') and stops polling on ${status}`, async () => {
      client.pollAuthorizationRequest.and.resolveTo({ status });
      buildPoller().start();

      jasmine.clock().tick(5000);
      await flush();

      expect(onRejected).toHaveBeenCalledOnceWith(status);
      expect(onApproved).not.toHaveBeenCalled();

      jasmine.clock().tick(30000);
      await flush();

      expect(client.pollAuthorizationRequest).toHaveBeenCalledTimes(1);
    });
  });

  it("fires onRejected('notFound') and stops on a 404 ApiError", async () => {
    const error = new Error('not found');
    error.status = 404;
    client.pollAuthorizationRequest.and.rejectWith(error);
    buildPoller().start();

    jasmine.clock().tick(5000);
    await flush();

    expect(onRejected).toHaveBeenCalledOnceWith('notFound');

    jasmine.clock().tick(30000);
    await flush();

    expect(client.pollAuthorizationRequest).toHaveBeenCalledTimes(1);
  });

  it('keeps polling after a transient network error', async () => {
    client.pollAuthorizationRequest.and.rejectWith(new TypeError('network down'));
    buildPoller().start();

    jasmine.clock().tick(5000);
    await flush();
    jasmine.clock().tick(5000);
    await flush();

    expect(client.pollAuthorizationRequest).toHaveBeenCalledTimes(2);
    expect(onRejected).not.toHaveBeenCalled();
  });

  it("rejects with 'expired' and never polls once expiresAt has passed", async () => {
    client.pollAuthorizationRequest.and.resolveTo({ status: 'open' });
    buildPoller({ expiresAt: '2026-09-08T23:59:00.000Z' }).start();

    jasmine.clock().tick(0);
    await flush();

    expect(onRejected).toHaveBeenCalledOnceWith('expired');
    expect(client.pollAuthorizationRequest).not.toHaveBeenCalled();
  });

  it('cancels a pending tick when stopped before it fires', async () => {
    client.pollAuthorizationRequest.and.resolveTo({ status: 'open' });
    const poller = buildPoller();
    poller.start();

    poller.stop();
    jasmine.clock().tick(5000);
    await flush();

    expect(client.pollAuthorizationRequest).not.toHaveBeenCalled();
  });

  it('neutralises an in-flight tick so it neither reschedules nor fires callbacks', async () => {
    let resolvePoll;
    client.pollAuthorizationRequest.and.returnValue(new Promise((resolve) => {
      resolvePoll = resolve;
    }));
    const poller = buildPoller();
    poller.start();

    jasmine.clock().tick(5000);
    await flush();

    poller.stop();
    resolvePoll({ status: 'open' });
    await flush();

    expect(onTick).not.toHaveBeenCalled();
    expect(client.pollAuthorizationRequest).toHaveBeenCalledTimes(1);

    jasmine.clock().tick(5000);
    await flush();

    expect(client.pollAuthorizationRequest).toHaveBeenCalledTimes(1);
  });
});

describe('buildPollTick', () => {
  let client;
  let onApproved;
  let onRejected;
  let onTick;
  let reschedule;

  beforeEach(() => {
    client = jasmine.createSpyObj('client', ['pollAuthorizationRequest']);
    onApproved = jasmine.createSpy('onApproved');
    onRejected = jasmine.createSpy('onRejected');
    onTick = jasmine.createSpy('onTick');
    reschedule = jasmine.createSpy('reschedule');
  });

  /**
   * Build a single tick wired to the shared spies.
   *
   * @param {object} overrides - Option overrides (typically `expiresAt`).
   * @returns {Function} The tick function.
   */
  function buildTick(overrides = {}) {
    return buildPollTick({
      uuid: 'req-uuid',
      pollToken: 'poll-token',
      expiresAt: '2999-01-01T00:00:00.000Z',
      client,
      onApproved,
      onRejected,
      onTick,
      reschedule,
      ...overrides,
    });
  }

  it('reschedules and ticks on an open status', async () => {
    client.pollAuthorizationRequest.and.resolveTo({ status: 'open' });

    await buildTick()();

    expect(onTick).toHaveBeenCalledTimes(1);
    expect(reschedule).toHaveBeenCalledTimes(1);
    expect(onApproved).not.toHaveBeenCalled();
    expect(onRejected).not.toHaveBeenCalled();
  });

  it('treats a falsy resolve as open', async () => {
    client.pollAuthorizationRequest.and.resolveTo(undefined);

    await buildTick()();

    expect(reschedule).toHaveBeenCalledTimes(1);
    expect(onRejected).not.toHaveBeenCalled();
  });

  it('forwards the result to onApproved without rescheduling on approved', async () => {
    const result = { status: 'approved', refreshToken: 'refresh-token' };
    client.pollAuthorizationRequest.and.resolveTo(result);

    await buildTick()();

    expect(onApproved).toHaveBeenCalledOnceWith(result);
    expect(reschedule).not.toHaveBeenCalled();
  });

  ['denied', 'expired', 'logged'].forEach((status) => {
    it(`rejects with '${status}' without rescheduling`, async () => {
      client.pollAuthorizationRequest.and.resolveTo({ status });

      await buildTick()();

      expect(onRejected).toHaveBeenCalledOnceWith(status);
      expect(reschedule).not.toHaveBeenCalled();
    });
  });

  it("rejects with 'notFound' on a 404 ApiError", async () => {
    const error = new Error('not found');
    error.status = 404;
    client.pollAuthorizationRequest.and.rejectWith(error);

    await buildTick()();

    expect(onRejected).toHaveBeenCalledOnceWith('notFound');
    expect(reschedule).not.toHaveBeenCalled();
  });

  it('swallows a non-404 error and reschedules', async () => {
    client.pollAuthorizationRequest.and.rejectWith(new TypeError('network down'));

    await buildTick()();

    expect(onRejected).not.toHaveBeenCalled();
    expect(onTick).toHaveBeenCalledTimes(1);
    expect(reschedule).toHaveBeenCalledTimes(1);
  });

  it("rejects with 'expired' and never polls when expiresAt is in the past", async () => {
    const past = new Date(Date.now() - 1000).toISOString();

    await buildTick({ expiresAt: past })();

    expect(onRejected).toHaveBeenCalledOnceWith('expired');
    expect(client.pollAuthorizationRequest).not.toHaveBeenCalled();
    expect(reschedule).not.toHaveBeenCalled();
  });
});
