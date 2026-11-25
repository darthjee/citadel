/**
 * The shape signed into the access token by `TokenService#issueTokens`
 * (`backend/src/auth/token.service.ts`) and verified by `JwtGuard`
 * (`backend/src/core/jwt.guard.ts`), which assigns it to `request.user`.
 * `sid` is the `session_uuid` of the refresh-token row the token was minted
 * with. `username`/`isAdmin` are informational for the frontend: the backend
 * reads them from the database on every request (see `JwtGuard`).
 * Lives in `core/` (not `auth/`) to avoid an `auth → core` type import
 * cycle and to let `express.d.ts` import it directly.
 */
export interface AccessTokenPayload {
  sub: number;
  sid: string;
  username: string;
  isAdmin: boolean;
}
