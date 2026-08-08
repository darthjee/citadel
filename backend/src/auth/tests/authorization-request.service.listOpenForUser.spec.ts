import {
  buildFakeAuthorizationRequest,
  useAuthorizationRequestServiceContext,
} from './authorization-request.service.test-support.js';

describe('AuthorizationRequestService', () => {
  const ctx = useAuthorizationRequestServiceContext();

  describe('listOpenForUser', () => {
    const openRow = buildFakeAuthorizationRequest({ id: 1, uuid: 'uuid-open' });

    it('queries only open, non-expired rows for the given userId, newest first', async () => {
      ctx.authorizationRequestRepository.find.mockResolvedValue([openRow]);

      await ctx.service.listOpenForUser(1);

      expect(ctx.authorizationRequestRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 1, status: 'open' }),
          order: { createdAt: 'DESC' },
        }),
      );
    });

    it('maps rows to the public shape only, leaking no id/pollTokenHash/username/approvedByUserId', async () => {
      ctx.authorizationRequestRepository.find.mockResolvedValue([openRow]);

      const result = await ctx.service.listOpenForUser(1);

      expect(result).toEqual([
        {
          uuid: 'uuid-open',
          requestIp: '203.0.113.1',
          requestUserAgent: 'curl/8.0',
          createdAt: openRow.createdAt,
          expiresAt: openRow.expiresAt,
        },
      ]);
    });

    it('returns an empty array when nothing matches (userId: null / other users / expired / non-open excluded by the WHERE clause)', async () => {
      ctx.authorizationRequestRepository.find.mockResolvedValue([]);

      await expect(ctx.service.listOpenForUser(1)).resolves.toEqual([]);
    });
  });
});
