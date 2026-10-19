import { ConfigService } from '@nestjs/config';
import { UserStatus } from '../entities/user.entity.js';
import { UserApprovalConfig } from '../user-approval.config.js';

function configFor(value: string | undefined): UserApprovalConfig {
  const configService = {
    get: (key: string) => (key === 'CITADEL_PLACEHOLDER_USER_APPROVAL_REQUIRED' ? value : undefined),
  } as unknown as ConfigService;

  return UserApprovalConfig.fromConfigService(configService);
}

describe('UserApprovalConfig', () => {
  describe("when the flag is exactly 'true'", () => {
    const config = configFor('true');

    it('requires approval', () => {
      expect(config.required).toBe(true);
    });

    it('registers new users as pending', () => {
      expect(config.registrationStatus()).toBe(UserStatus.PENDING);
    });
  });

  describe.each([
    ['unset', undefined],
    ['empty', ''],
    ["'false'", 'false'],
    ["'TRUE'", 'TRUE'],
    ["'1'", '1'],
    ["' true '", ' true '],
  ])('when the flag is %s', (_label, value) => {
    const config = configFor(value);

    it('does not require approval', () => {
      expect(config.required).toBe(false);
    });

    it('registers new users as approved', () => {
      expect(config.registrationStatus()).toBe(UserStatus.APPROVED);
    });
  });

  it('is immutable once built', () => {
    const config = configFor('true');

    expect(Object.isFrozen(config)).toBe(true);
    expect(() => {
      (config as unknown as { required: boolean }).required = false;
    }).toThrow(TypeError);
    expect(config.required).toBe(true);
  });
});
