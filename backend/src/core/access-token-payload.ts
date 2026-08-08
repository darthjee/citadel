/**
 * The shape signed into the access token by `AuthService#issueTokens`
 * (`backend/src/auth/auth.service.ts`) and verified by `JwtGuard`
 * (`backend/src/core/jwt.guard.ts`), which assigns it to `request.user`.
 * Lives in `core/` (not `auth/`) to avoid an `auth → core` type import
 * cycle and to let `express.d.ts` import it directly.
 */
export interface AccessTokenPayload {
  sub: number;
  username: string;
  isAdmin: boolean;
}
