/**
 * Fired (via `EventEmitter2`, event name `user.registered`) when a new user
 * successfully registers. No listener consumes it yet — out of scope for
 * this issue — it only needs to fire with the right payload.
 */
export class UserRegisteredEvent {
  constructor(
    /** The newly created user's ID. */
    readonly userId: number,
    /** The newly created user's username. */
    readonly username: string,
    /** The newly created user's email. */
    readonly email: string,
  ) {}
}
