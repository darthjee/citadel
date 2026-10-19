import { transitionRequest } from '../authorization-request-transition.js';
import { queryBuilderMock } from './authorization-request.service.test-support.js';

describe('transitionRequest', () => {
  function repositoryReturning(executeResult: { affected?: number }): {
    builder: ReturnType<typeof queryBuilderMock>;
    repository: never;
  } {
    const builder = queryBuilderMock(executeResult as { affected: number });

    return { builder, repository: { createQueryBuilder: jest.fn(() => builder) } as never };
  }

  it('runs one guarded UPDATE on the uuid and the expected current status', async () => {
    const { builder, repository } = repositoryReturning({ affected: 1 });

    await transitionRequest(repository, 'uuid-1', 'logged', { status: 'denied' });

    expect(builder.set).toHaveBeenCalledWith({ status: 'denied' });
    expect(builder.where).toHaveBeenCalledWith('uuid = :uuid AND status = :status', { uuid: 'uuid-1', status: 'logged' });
    expect(builder.execute).toHaveBeenCalledTimes(1);
  });

  it('resolves with the number of affected rows', async () => {
    const { repository } = repositoryReturning({ affected: 1 });

    await expect(transitionRequest(repository, 'uuid-1', 'approved', { status: 'logged' })).resolves.toBe(1);
  });

  it('resolves with 0 when the driver reports no affected count', async () => {
    const { repository } = repositoryReturning({});

    await expect(transitionRequest(repository, 'uuid-1', 'approved', { status: 'logged' })).resolves.toBe(0);
  });
});
