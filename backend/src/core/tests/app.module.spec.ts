import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { buildJwtSignOptions, DEFAULT_ACCESS_TOKEN_TTL_MS } from '../../app.module.js';

// Covers `AppModule`'s `JwtModule.registerAsync` sign-options wiring in
// isolation (extracted as `buildJwtSignOptions`) — booting the full
// `AppModule` would also try to establish a real MySQL connection via
// `TypeOrmModule.forRootAsync`, which CI's `backend_tests` job has no
// database service container for yet.
describe('buildJwtSignOptions', () => {
  describe('when CITADEL_PLACEHOLDER_ACCESS_TOKEN_TTL_MS is unset', () => {
    it('defaults expiresIn to 900 seconds (15 minutes)', () => {
      const configService = { get: jest.fn((_key: string, defaultValue: number) => defaultValue) };

      const signOptions = buildJwtSignOptions(configService as unknown as ConfigService);

      expect(configService.get).toHaveBeenCalledWith('CITADEL_PLACEHOLDER_ACCESS_TOKEN_TTL_MS', DEFAULT_ACCESS_TOKEN_TTL_MS);
      expect(signOptions).toEqual({ expiresIn: 900 });
    });
  });

  describe('when CITADEL_PLACEHOLDER_ACCESS_TOKEN_TTL_MS is set to 3600000 (1 hour)', () => {
    it('converts it to 3600 seconds', () => {
      const configService = { get: jest.fn().mockReturnValue(3_600_000) };

      const signOptions = buildJwtSignOptions(configService as unknown as ConfigService);

      expect(signOptions).toEqual({ expiresIn: 3_600 });
    });

    it('signs a token whose exp claim reflects the configured expiry', () => {
      const configService = { get: jest.fn().mockReturnValue(3_600_000) };
      const signOptions = buildJwtSignOptions(configService as unknown as ConfigService);
      const jwtService = new JwtService({ secret: 'test-secret' });
      const nowSeconds = Math.floor(Date.now() / 1000);

      const token = jwtService.sign({ sub: 1 }, signOptions);
      const decoded = jwtService.decode<{ exp: number }>(token);

      expect(decoded.exp).toBeGreaterThanOrEqual(nowSeconds + 3_600 - 1);
      expect(decoded.exp).toBeLessThanOrEqual(nowSeconds + 3_600 + 1);
    });
  });
});
