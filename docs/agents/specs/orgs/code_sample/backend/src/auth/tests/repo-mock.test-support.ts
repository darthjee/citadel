export type RepoMock<T extends object> = {
  findOne: jest.Mock;
  findOneBy: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  update: jest.Mock;
} & Partial<T>;

/**
 * Builds a fake TypeORM repository with jest.fn() stubs for the methods
 * shared by the auth service specs (`findOne`, `findOneBy`, `create`,
 * `save` and `update`).
 *
 * @returns a repository mock whose `create` echoes its input and whose
 * `save` resolves the entity with a default `id` of 1.
 */
export function repoMock<T extends object>(): RepoMock<T> {
  return {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn((attrs) => attrs),
    save: jest.fn(async (entity) => ({ id: 1, ...entity })),
    update: jest.fn(),
  } as RepoMock<T>;
}
