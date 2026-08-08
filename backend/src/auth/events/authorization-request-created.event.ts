/**
 * Fired (via `EventEmitter2`, event name `authorization-request.created`)
 * when a new device-authorization request is created. No listener consumes
 * it yet — out of scope for this issue — it only needs to fire with the
 * right payload.
 */
export class AuthorizationRequestCreatedEvent {
  constructor(
    /** The newly created authorization request's UUID. */
    readonly uuid: string,
    /** The username originally submitted, whether or not it resolved to a real user. */
    readonly username: string,
    /** The resolved user's ID, or `null` when `username` did not resolve to a real user. */
    readonly userId: number | null,
  ) {}
}
