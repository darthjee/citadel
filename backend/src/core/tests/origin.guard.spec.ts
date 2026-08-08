import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isCrossSiteRequestAllowed, OriginCheckRequest, OriginGuard } from '../origin.guard.js';

const TRUSTED = 'https://app.example.com';
const EVIL = 'https://evil.example.org';
const HOST = 'api.example.com';

function allowed(request: Partial<OriginCheckRequest>, trusted: string[] | true = [TRUSTED]): boolean {
  return isCrossSiteRequestAllowed({ method: 'POST', ...request }, trusted);
}

function fakeConfigService(env: Record<string, string | undefined>): ConfigService {
  return { get: jest.fn((key: string) => env[key]) } as unknown as ConfigService;
}

function contextFor(method: string, headers: Record<string, string | string[]>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ method, headers }) }),
  } as unknown as ExecutionContext;
}

describe('isCrossSiteRequestAllowed', () => {
  describe('safe methods', () => {
    it.each(['GET', 'HEAD', 'OPTIONS'])('always allows %s, even cross-site from an untrusted origin', (method) => {
      expect(allowed({ method, secFetchSite: 'cross-site', origin: EVIL })).toBe(true);
    });
  });

  describe.each(['POST', 'PUT', 'PATCH', 'DELETE', 'post'])('state-changing method %s', (method) => {
    describe('with Sec-Fetch-Site same-origin or none', () => {
      it.each(['same-origin', 'none'])('allows %s with any origin', (secFetchSite) => {
        expect(allowed({ method, secFetchSite, origin: EVIL })).toBe(true);
        expect(allowed({ method, secFetchSite })).toBe(true);
      });
    });

    describe.each(['same-site', 'cross-site'])('with Sec-Fetch-Site %s', (secFetchSite) => {
      it('allows a trusted origin', () => {
        expect(allowed({ method, secFetchSite, origin: TRUSTED })).toBe(true);
      });

      it('rejects an absent origin', () => {
        expect(allowed({ method, secFetchSite })).toBe(false);
      });

      it('rejects an untrusted origin', () => {
        expect(allowed({ method, secFetchSite, origin: EVIL })).toBe(false);
      });

      it('rejects an untrusted origin even when its host matches Host', () => {
        expect(allowed({ method, secFetchSite, origin: `https://${HOST}`, host: HOST })).toBe(false);
      });

      it('rejects the null origin', () => {
        expect(allowed({ method, secFetchSite, origin: 'null' })).toBe(false);
      });
    });

    describe('without Sec-Fetch-Site', () => {
      it('allows a request with no Origin (non-browser client)', () => {
        expect(allowed({ method, host: HOST })).toBe(true);
      });

      it('allows a trusted origin', () => {
        expect(allowed({ method, origin: TRUSTED, host: HOST })).toBe(true);
      });

      it('allows an origin whose host equals the Host header', () => {
        expect(allowed({ method, origin: `https://${HOST}`, host: HOST })).toBe(true);
      });

      it('compares the host including the port', () => {
        expect(allowed({ method, origin: 'http://localhost:3000', host: 'localhost:3000' })).toBe(true);
        expect(allowed({ method, origin: 'http://localhost:3001', host: 'localhost:3000' })).toBe(false);
      });

      it('rejects an untrusted origin with a different host', () => {
        expect(allowed({ method, origin: EVIL, host: HOST })).toBe(false);
      });

      it('rejects an untrusted origin when Host is absent', () => {
        expect(allowed({ method, origin: EVIL })).toBe(false);
      });

      it('rejects the null origin', () => {
        expect(allowed({ method, origin: 'null', host: HOST })).toBe(false);
      });
    });
  });

  describe('with an unknown Sec-Fetch-Site value', () => {
    it('requires a trusted origin', () => {
      expect(allowed({ secFetchSite: 'bogus', origin: TRUSTED })).toBe(true);
      expect(allowed({ secFetchSite: 'bogus', origin: EVIL })).toBe(false);
    });
  });

  describe('when trustedOrigins is true (wildcard)', () => {
    it('allows any parseable cross-site origin', () => {
      expect(allowed({ secFetchSite: 'cross-site', origin: EVIL }, true)).toBe(true);
      expect(allowed({ origin: EVIL, host: HOST }, true)).toBe(true);
    });

    it('still rejects the null origin', () => {
      expect(allowed({ secFetchSite: 'cross-site', origin: 'null' }, true)).toBe(false);
      expect(allowed({ origin: 'null', host: HOST }, true)).toBe(false);
    });
  });

  describe('when trustedOrigins is empty', () => {
    it('rejects every cross-site origin', () => {
      expect(allowed({ secFetchSite: 'cross-site', origin: TRUSTED }, [])).toBe(false);
    });

    it('still allows same-origin and non-browser requests', () => {
      expect(allowed({ secFetchSite: 'same-origin', origin: EVIL }, [])).toBe(true);
      expect(allowed({}, [])).toBe(true);
      expect(allowed({ origin: `https://${HOST}`, host: HOST }, [])).toBe(true);
    });
  });
});

describe('OriginGuard', () => {
  describe('with CITADEL_PLACEHOLDER_ALLOWED_ORIGINS set', () => {
    const guard = new OriginGuard(fakeConfigService({ CITADEL_PLACEHOLDER_ALLOWED_ORIGINS: TRUSTED }));

    it('returns true for a trusted cross-site request', () => {
      expect(guard.canActivate(contextFor('POST', { 'sec-fetch-site': 'cross-site', origin: TRUSTED }))).toBe(true);
    });

    it('returns true for a safe method', () => {
      expect(guard.canActivate(contextFor('GET', { 'sec-fetch-site': 'cross-site', origin: EVIL }))).toBe(true);
    });

    it('throws ForbiddenException for a forged request', () => {
      expect(() => guard.canActivate(contextFor('POST', { 'sec-fetch-site': 'cross-site', origin: EVIL }))).toThrow(
        new ForbiddenException('Cross-site request rejected'),
      );
    });

    it('reads the first value of a repeated header', () => {
      expect(() => guard.canActivate(contextFor('DELETE', { origin: [EVIL, TRUSTED], host: HOST }))).toThrow(
        ForbiddenException,
      );
    });

    it('allows a legacy same-origin request via the Host header', () => {
      expect(guard.canActivate(contextFor('PUT', { origin: `https://${HOST}`, host: HOST }))).toBe(true);
    });
  });

  describe('with FRONTEND_BASE_URL as the fallback', () => {
    const guard = new OriginGuard(fakeConfigService({ FRONTEND_BASE_URL: `${TRUSTED}/some/path` }));

    it('trusts the frontend origin', () => {
      expect(guard.canActivate(contextFor('POST', { 'sec-fetch-site': 'cross-site', origin: TRUSTED }))).toBe(true);
    });
  });

  describe('with no allowlist configured', () => {
    const guard = new OriginGuard(fakeConfigService({}));

    it('rejects any cross-site request', () => {
      expect(() => guard.canActivate(contextFor('POST', { 'sec-fetch-site': 'cross-site', origin: TRUSTED }))).toThrow(
        ForbiddenException,
      );
    });

    it('allows a request without Origin or Sec-Fetch-Site', () => {
      expect(guard.canActivate(contextFor('POST', {}))).toBe(true);
    });
  });

  describe('with the non-production wildcard', () => {
    const guard = new OriginGuard(fakeConfigService({ CITADEL_PLACEHOLDER_ALLOWED_ORIGINS: '*' }));

    it('trusts any cross-site origin', () => {
      expect(guard.canActivate(contextFor('POST', { 'sec-fetch-site': 'cross-site', origin: EVIL }))).toBe(true);
    });
  });
});
