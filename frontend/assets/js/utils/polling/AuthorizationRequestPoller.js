import AccountsClient from '../../client/AccountsClient.js';

const DEFAULT_INTERVAL_MS = 5000;

/**
 * Route a resolved poll response to the right callback: `approved` finishes with the full
 * result, the terminal rejection statuses (`denied` / `expired` / `logged`) finish with their
 * reason, and anything else — including a falsy / `undefined` resolve — is treated as `open`,
 * firing `onTick` and rescheduling another poll.
 *
 * @param {{status?: string}} result - The response from
 *   `AccountsClient.pollAuthorizationRequest`, possibly falsy.
 * @param {{onApproved: Function, onRejected: Function, onTick: Function,
 *   reschedule: Function}} callbacks - Dispatch targets for each outcome.
 * @returns {void} Nothing.
 */
function dispatchPollResult(result, {
  onApproved, onRejected, onTick, reschedule,
}) {
  const status = (result && result.status) || 'open';

  if (status === 'approved') {
    onApproved(result);
    return;
  }

  if (status === 'denied' || status === 'expired' || status === 'logged') {
    onRejected(status);
    return;
  }

  if (onTick) onTick();
  reschedule();
}

/**
 * Handle a thrown poll error: a `404` `ApiError` (unknown request or wrong poll token) is
 * terminal and finishes with `notFound`; any other error (a network `TypeError` with no
 * `.status`) is swallowed so the poller never gives up — it fires `onTick` and reschedules.
 *
 * @param {{status?: number}} error - The error thrown by
 *   `AccountsClient.pollAuthorizationRequest`.
 * @param {{onRejected: Function, onTick: Function, reschedule: Function}} callbacks - Dispatch
 *   targets for each outcome.
 * @returns {void} Nothing.
 */
function handlePollError(error, { onRejected, onTick, reschedule }) {
  if (error && error.status === 404) {
    onRejected('notFound');
    return;
  }

  if (onTick) onTick();
  reschedule();
}

/**
 * Build the body of a single poll tick as a standalone function, so specs can drive one tick
 * directly with plain spies and no timers — mirroring `buildAuthEffect` / `buildLoginModalEffect`.
 * The returned function first short-circuits to `onRejected('expired')` with no network call
 * once `expiresAt` has passed, otherwise polls once via `client.pollAuthorizationRequest` and
 * dispatches the result (see {@link dispatchPollResult}) or the thrown error (see
 * {@link handlePollError}).
 *
 * @param {{uuid: string, pollToken: string, expiresAt: string, client: object,
 *   onApproved: Function, onRejected: Function, onTick: Function, reschedule: Function}} options -
 *   The request identifiers, the poll client, and the outcome callbacks.
 * @returns {Function} An async function that performs exactly one poll tick.
 */
export function buildPollTick({
  uuid, pollToken, expiresAt, client, onApproved, onRejected, onTick, reschedule,
}) {
  const expiryMs = Date.parse(expiresAt);

  return async () => {
    if (Number.isFinite(expiryMs) && Date.now() >= expiryMs) {
      onRejected('expired');
      return;
    }

    try {
      const result = await client.pollAuthorizationRequest(uuid, pollToken);
      dispatchPollResult(result, {
        onApproved, onRejected, onTick, reschedule,
      });
    } catch (error) {
      handlePollError(error, { onRejected, onTick, reschedule });
    }
  };
}

/**
 * Drives an authorization request to completion by polling
 * `AccountsClient.pollAuthorizationRequest` on a `setTimeout` cadence. `onApproved` fires once
 * with the winning `approved` result; `onRejected` fires once with `'denied'` / `'expired'` /
 * `'logged'` / `'notFound'`. Transient network errors are retried forever. The poller stops
 * itself on any terminal outcome, and `stop()` neutralises a tick that is still in flight so it
 * neither reschedules nor fires a callback. In an environment without `setTimeout` (SSR, plain
 * Node specs that never call `start()`), `start()` is a no-op.
 */
export default class AuthorizationRequestPoller {
  #uuid;

  #pollToken;

  #expiresAt;

  #client;

  #intervalMs;

  #onApproved;

  #onRejected;

  #onTick;

  #tickHandle = null;

  #expiryHandle = null;

  #stopped = false;

  /**
   * Create a poller for a single authorization request.
   *
   * @param {{uuid: string, pollToken: string, expiresAt: string, client?: object,
   *   intervalMs?: number, onApproved?: Function, onRejected?: Function,
   *   onTick?: Function}} options - The request returned by
   *   `AccountsClient.createAuthorizationRequest`, plus polling cadence and outcome callbacks.
   *   `client` defaults to `AccountsClient` and `intervalMs` to `5000`.
   */
  constructor({
    uuid,
    pollToken,
    expiresAt,
    client = AccountsClient,
    intervalMs = DEFAULT_INTERVAL_MS,
    onApproved,
    onRejected,
    onTick,
  }) {
    this.#uuid = uuid;
    this.#pollToken = pollToken;
    this.#expiresAt = expiresAt;
    this.#client = client;
    this.#intervalMs = intervalMs;
    this.#onApproved = onApproved;
    this.#onRejected = onRejected;
    this.#onTick = onTick;
  }

  /**
   * Schedule the first poll tick and arm a dedicated timer that rejects promptly with
   * `'expired'` the moment `expiresAt` passes, rather than waiting for the next interval. A
   * no-op when `setTimeout` is unavailable or the poller was already stopped.
   *
   * @returns {void} Nothing.
   */
  start() {
    if (typeof setTimeout === 'undefined') return;
    if (this.#stopped) return;

    this.#scheduleTick();
    this.#armExpiry();
  }

  /**
   * Cancel every pending timer and mark the poller stopped, so an in-flight tick that resolves
   * afterwards neither reschedules nor fires callbacks. Safe to call more than once.
   *
   * @returns {void} Nothing.
   */
  stop() {
    this.#stopped = true;

    if (this.#tickHandle !== null) {
      clearTimeout(this.#tickHandle);
      this.#tickHandle = null;
    }

    if (this.#expiryHandle !== null) {
      clearTimeout(this.#expiryHandle);
      this.#expiryHandle = null;
    }
  }

  /**
   * Schedule the next poll tick one interval out, wiring the tick's callbacks back through the
   * poller's stop-aware guards.
   *
   * @returns {void} Nothing.
   */
  #scheduleTick() {
    const tick = buildPollTick({
      uuid: this.#uuid,
      pollToken: this.#pollToken,
      expiresAt: this.#expiresAt,
      client: this.#client,
      onApproved: (result) => this.#finish(this.#onApproved, result),
      onRejected: (reason) => this.#finish(this.#onRejected, reason),
      onTick: () => this.#guardedTick(),
      reschedule: () => this.#reschedule(),
    });

    this.#tickHandle = setTimeout(() => {
      this.#tickHandle = null;
      if (this.#stopped) return;
      tick();
    }, this.#intervalMs);
  }

  /**
   * Arm a one-shot timer that fires `onRejected('expired')` exactly when `expiresAt` is
   * reached (immediately when it is already in the past). Skipped when `expiresAt` is not a
   * parseable date.
   *
   * @returns {void} Nothing.
   */
  #armExpiry() {
    const expiryMs = Date.parse(this.#expiresAt);
    if (!Number.isFinite(expiryMs)) return;

    const delay = Math.max(expiryMs - Date.now(), 0);

    this.#expiryHandle = setTimeout(() => {
      this.#expiryHandle = null;
      this.#finish(this.#onRejected, 'expired');
    }, delay);
  }

  /**
   * Run a terminal callback once: ignored when the poller is already stopped, otherwise it
   * stops the poller first (cancelling every timer) and then invokes the callback.
   *
   * @param {Function} callback - `onApproved` or `onRejected`.
   * @param {*} argument - The result object or the rejection reason string.
   * @returns {void} Nothing.
   */
  #finish(callback, argument) {
    if (this.#stopped) return;

    this.stop();
    if (callback) callback(argument);
  }

  /**
   * Forward an `open`-status tick to `onTick`, unless the poller was stopped mid-flight.
   *
   * @returns {void} Nothing.
   */
  #guardedTick() {
    if (this.#stopped) return;
    if (this.#onTick) this.#onTick();
  }

  /**
   * Schedule the next tick after an `open` poll, unless the poller was stopped mid-flight.
   *
   * @returns {void} Nothing.
   */
  #reschedule() {
    if (this.#stopped) return;
    this.#scheduleTick();
  }
}
