import type { Request } from 'express';
import { organizationCreateInvalidation, organizationRenameInvalidation } from '../organization-invalidation.js';

const requestWith = (orgId: unknown): Request => ({ params: { orgId } }) as unknown as Request;

describe('organizationCreateInvalidation', () => {
  it('invalidates only the organization list', () => {
    expect(organizationCreateInvalidation()).toEqual(['/orgs.json']);
  });
});

describe('organizationRenameInvalidation', () => {
  it('invalidates the list and the parsed organization document', () => {
    expect(organizationRenameInvalidation(requestWith('42'))).toEqual(['/orgs.json', '/orgs/42.json']);
  });

  it.each(['abc', '007', '-1', '1e3', '2147483648', '../x', undefined])(
    'falls back to the list alone for the unparseable id %p',
    (orgId) => {
      expect(organizationRenameInvalidation(requestWith(orgId))).toEqual(['/orgs.json']);
    },
  );

  it('never emits the recursive /orgs prefix', () => {
    expect(organizationRenameInvalidation(requestWith('3'))).not.toContain('/orgs');
  });
});
