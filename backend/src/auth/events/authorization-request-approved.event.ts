/**
 * Fired (via `EventEmitter2`, event name `authorization-request.approved`)
 * when the approver device authorizes a device-authorization request. No
 * listener consumes it yet — out of scope for this issue — it only needs to
 * fire with the right payload.
 */
export class AuthorizationRequestApprovedEvent {
  constructor(
    /** The authorization request's UUID. */
    readonly uuid: string,
    /** The ID of the user who approved the request. */
    readonly approvedByUserId: number,
  ) {}
}
