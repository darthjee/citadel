# Plan: Login with an invalid password throws `TypeError: can't access property "refreshToken"` instead of showing the 401 message

Issue: [22-login-with-an-invalid-password-throws-typeerror-can-t-access-property-refreshtoken-instead-of-showing-the-401-message.md](../../issues/22-login-with-an-invalid-password-throws-typeerror-can-t-access-property-refreshtoken-instead-of-showing-the-401-message.md)

## Overview
Port Ward's fix ([darthjee/ward#158](https://github.com/darthjee/ward/issues/158), commit
[`aa398da`](https://github.com/darthjee/ward/commit/aa398da35dfc7f7b14f94882c120b3259c5152b1))
to citadel. A `401` from a public auth route surfaces as a normal `ApiError` (no refresh, no
retry, no session change), and a failed session recovery on authenticated routes rejects with
an `ApiError` marked `sessionExpired` instead of resolving `undefined`. Consumers that relied on
the silent `undefined` are updated to recognise the session-expired rejection and stay quiet
next to the re-opened login modal. The work is frontend-only; the architect updates the
permanent docs at the end.

See [frontend.md](frontend.md) for the full plan.
