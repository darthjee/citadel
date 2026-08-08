/**
 * Fired (via `EventEmitter2`, event name `authorization-request.denied`)
 * when the approver device denies a device-authorization request. No
 * listener consumes it yet — out of scope for this issue — it only needs to
 * fire with the right payload.
 */
export class AuthorizationRequestDeniedEvent {
  constructor(
    /** The authorization request's UUID. */
    readonly uuid: string,
    /** The ID of the user who denied the request. */
    readonly deniedByUserId: number,
  ) {}
}
