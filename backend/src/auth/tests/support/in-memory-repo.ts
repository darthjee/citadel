// Matches a single condition value against a row's field, understanding
// the TypeORM find operators the auth specs rely on (`IsNull()`, used by
// `TokenService#revokeUserTokens`; `MoreThan()`; `ILike()`, used by the
// admin user search; `Not()`, used by `AuthService#assertAvailableForUpdate`'s
// self-exclusion) in addition to plain equality — real TypeORM/MySQL
// handles them natively, this in-memory stand-in needs to special-case them.
export function matchesCondition(rowValue: unknown, conditionValue: unknown): boolean {
  if (conditionValue && typeof conditionValue === 'object' && 'type' in conditionValue) {
    const operator = conditionValue as { type: string; value: unknown };

    if (operator.type === 'isNull') {
      return rowValue === null || rowValue === undefined;
    }

    if (operator.type === 'moreThan') {
      return (rowValue as Date) > (operator.value as Date);
    }

    if (operator.type === 'not') {
      return !matchesCondition(rowValue, operator.value);
    }

    if (operator.type === 'ilike') {
      return String(rowValue).toLowerCase().includes(String(operator.value).replace(/%/g, '').toLowerCase());
    }

    return false;
  }

  return rowValue === conditionValue;
}

// Standing in for a real database, mirroring the CI comment on
// `backend_tests`'s "No DB service container yet" strategy: backend specs
// inject mocked TypeORM repositories rather than hitting a live database.
// Shared by every auth e2e spec/support file — includes a
// `createQueryBuilder().update().set().where().execute()` stub, needed by
// `AuthorizationRequestService`'s atomic `approved → logged` claim and
// `logged → denied` re-check: the guarded `UPDATE ... WHERE status = :status` is simulated by
// checking+mutating the matching row synchronously inside `execute()`, so
// two concurrent callers still race exactly like a real guarded SQL
// `UPDATE` would.
export function createInMemoryRepo<T extends { id?: number }>() {
  const rows: T[] = [];
  let nextId = 1;

  const repo = {
    rows,
    create: (attrs: Partial<T>): T => ({ ...attrs }) as T,
    findOne: async ({ where }: { where: Partial<T> | Partial<T>[] }): Promise<T | null> => {
      const conditions = Array.isArray(where) ? where : [where];
      return (
        rows.find((row) =>
          conditions.some((condition) =>
            Object.entries(condition).every(([key, value]) => matchesCondition((row as never)[key], value)),
          ),
        ) ?? null
      );
    },
    find: async (
      { where, order }: { where?: Partial<T> | Partial<T>[]; order?: Partial<Record<keyof T, 'ASC' | 'DESC'>> } = {},
    ): Promise<T[]> => {
      const conditions = where ? (Array.isArray(where) ? where : [where]) : [];
      const matched =
        conditions.length === 0
          ? [...rows]
          : rows.filter((row) =>
            conditions.some((condition) =>
              Object.entries(condition).every(([key, value]) => matchesCondition((row as never)[key], value)),
            ),
          );

      const [field, direction] = order ? (Object.entries(order)[0] as [string, 'ASC' | 'DESC']) : [];

      if (!field) {
        return matched;
      }

      return matched.sort((a, b) => {
        const diff = new Date((a as never)[field]).getTime() - new Date((b as never)[field]).getTime();
        return direction === 'DESC' ? -diff : diff;
      });
    },
    findOneBy: async (where: Partial<T>): Promise<T | null> =>
      rows.find((row) =>
        Object.entries(where).every(([key, value]) => matchesCondition((row as never)[key], value)),
      ) ?? null,
    count: async ({ where }: { where: Partial<T> }): Promise<number> =>
      rows.filter((row) => Object.entries(where).every(([key, value]) => matchesCondition((row as never)[key], value)))
        .length,
    save: async (entity: T): Promise<T> => {
      if (entity.id === undefined) {
        entity.id = nextId++;
        // Real TypeORM auto-populates `@CreateDateColumn`/`@UpdateDateColumn`
        // (e.g. `User#createdAt`, `AuthorizationRequest#createdAt`) on
        // insert — this fake repo has to do the same so `createdAt` fields
        // round-trip through the admin search / `listOpenForUser` endpoints.
        (entity as never as { createdAt?: Date }).createdAt ??= new Date();
        rows.push(entity);
      }
      return entity;
    },
    // Resolves `{ affected }` (the number of matched rows), like TypeORM's `UpdateResult`, so
    // conditional updates (`AuthService`/`TokenService` rotation) can detect a lost race.
    update: async (criteria: number | Partial<T>, partial: Partial<T>): Promise<{ affected: number }> => {
      let affected = 0;

      rows.forEach((row) => {
        const matches =
          typeof criteria === 'object'
            ? Object.entries(criteria).every(([key, value]) => matchesCondition((row as never)[key], value))
            : row.id === criteria;

        if (matches) {
          Object.assign(row, partial);
          affected++;
        }
      });

      return { affected };
    },
    createQueryBuilder: () => {
      let setPayload: Record<string, unknown> = {};
      let whereParams: Record<string, unknown> = {};
      const builder = {
        update: (): typeof builder => builder,
        set: (payload: Record<string, unknown>): typeof builder => {
          setPayload = payload;
          return builder;
        },
        where: (_sql: string, params: Record<string, unknown>): typeof builder => {
          whereParams = params;
          return builder;
        },
        execute: async (): Promise<{ affected: number }> => {
          const row = rows.find(
            (candidate) =>
              (candidate as never)['uuid'] === whereParams.uuid && (candidate as never)['status'] === whereParams.status,
          );

          if (!row) {
            return { affected: 0 };
          }

          Object.entries(setPayload).forEach(([key, value]) => {
            (row as never)[key] = typeof value === 'function' ? new Date() : value;
          });

          return { affected: 1 };
        },
      };

      return builder;
    },
  };

  return { ...repo, manager: createFakeManager(repo) };
}

// A pass-through stand-in for `Repository#manager`: `transaction(cb)` runs `cb` with a fake
// `EntityManager` whose `getRepository()` returns the same in-memory repo. It is **not** a real
// transaction — there is no isolation and updates are never undone. The only rollback it mimics is
// dropping the rows inserted through it when the callback throws (so a lost rotation race leaves no
// stray replacement row). Real-engine transaction/concurrency checks live in
// `src/auth/tests/integration/token-rotation.integration-spec.ts` (`yarn test:integration`).
function createFakeManager<T extends { id?: number }>(repo: { rows: T[]; save: (entity: T) => Promise<T> }) {
  return {
    transaction: async <R>(callback: (manager: { getRepository: () => unknown }) => Promise<R>): Promise<R> => {
      const inserted: T[] = [];
      const save = async (entity: T): Promise<T> => {
        const isNew = entity.id === undefined;
        const saved = await repo.save(entity);

        if (isNew) {
          inserted.push(saved);
        }

        return saved;
      };

      try {
        return await callback({ getRepository: () => ({ ...repo, save }) });
      } catch (error) {
        inserted.forEach((row) => repo.rows.splice(repo.rows.indexOf(row), 1));
        throw error;
      }
    },
  };
}
