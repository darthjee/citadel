import { ForbiddenException } from '@nestjs/common';
import { hasMinRole, OrgRole, orgRoleForbidden } from '../org-role.js';

describe('hasMinRole', () => {
  it.each([
    [OrgRole.USER, OrgRole.USER, true],
    [OrgRole.USER, OrgRole.ADMIN, false],
    [OrgRole.USER, OrgRole.OWNER, false],
    [OrgRole.ADMIN, OrgRole.USER, true],
    [OrgRole.ADMIN, OrgRole.ADMIN, true],
    [OrgRole.ADMIN, OrgRole.OWNER, false],
    [OrgRole.OWNER, OrgRole.USER, true],
    [OrgRole.OWNER, OrgRole.ADMIN, true],
    [OrgRole.OWNER, OrgRole.OWNER, true],
  ])('hasMinRole(%p, %p) is %p', (role, min, expected) => {
    expect(hasMinRole(role, min)).toBe(expected);
  });
});

describe('orgRoleForbidden', () => {
  it('is a ForbiddenException', () => {
    expect(orgRoleForbidden()).toBeInstanceOf(ForbiddenException);
  });

  it('carries the Nest default body, naming neither resource nor role', () => {
    expect(orgRoleForbidden().getResponse()).toEqual({
      statusCode: 403,
      message: 'Forbidden',
    });
  });
});
