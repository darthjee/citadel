import type { Repository, UpdateQueryBuilder } from 'typeorm';
import type { AuthorizationRequest, AuthorizationRequestStatus } from './entities/authorization-request.entity.js';

/** The `SET` payload of a guarded authorization-request transition. */
export type TransitionSet = Parameters<UpdateQueryBuilder<AuthorizationRequest>['set']>[0];

/**
 * Moves an authorization request out of `from` with one guarded `UPDATE ... WHERE uuid = ? AND
 * status = ?`, so that of several concurrent callers only one can win (the others affect no row).
 * Shared by the poll's `approved → logged` claim and its `logged → denied` re-check.
 * @param {Repository<AuthorizationRequest>} repository - The authorization-request repository.
 * @param {string} uuid - The request's UUID.
 * @param {AuthorizationRequestStatus} from - The status the row must still have.
 * @param {TransitionSet} set - The columns to write.
 * @returns {Promise<number>} The number of affected rows (`1` for the winner, `0` otherwise).
 */
export async function transitionRequest(
  repository: Repository<AuthorizationRequest>,
  uuid: string,
  from: AuthorizationRequestStatus,
  set: TransitionSet,
): Promise<number> {
  const result = await repository
    .createQueryBuilder()
    .update()
    .set(set)
    .where('uuid = :uuid AND status = :status', { uuid, status: from })
    .execute();

  return result.affected ?? 0;
}
