/**
 * Fired (via `EventEmitter2`, event name `authorization-request.logged`)
 * when a device-authorization request's winning poll mints a session
 * (the `approved → logged` transition). No listener consumes it yet — out
 * of scope for this issue — it only needs to fire with the right payload.
 */
export class AuthorizationRequestLoggedEvent {
  constructor(
    /** The authorization request's UUID. */
    readonly uuid: string,
    /** The ID of the user who was logged in. */
    readonly userId: number,
  ) {}
}
