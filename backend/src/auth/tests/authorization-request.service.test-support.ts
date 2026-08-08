import { createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuthorizationRequestAbuseGuardService } from '../authorization-request-abuse-guard.service.js';
import { AuthorizationRequestService } from '../authorization-request.service.js';
import { AuthorizationRequest } from '../entities/authorization-request.entity.js';
import { User } from '../entities/user.entity.js';
import { TokenService } from '../token.service.js';

export type RepoMock<T extends object> = {
  findOneBy: jest.Mock;
  findOne: jest.Mock;
  find: jest.Mock;
  count: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  update: jest.Mock;
  createQueryBuilder: jest.Mock;
} & Partial<T>;

/**
 * Builds a fake TypeORM query builder mock resolving to a fixed UPDATE result.
 *
 * @param executeResult - the `{ affected }` shape returned by `execute()`.
 * @param executeResult.affected - the number of rows the UPDATE affected.
 * @returns a chainable `update/set/where/execute` mock.
 */
export function queryBuilderMock(executeResult: { affected: number }): {
  update: jest.Mock;
  set: jest.Mock;
  where: jest.Mock;
  execute: jest.Mock;
} {
  const builder = {
    update: jest.fn(() => builder),
    set: jest.fn(() => builder),
    where: jest.fn(() => builder),
    execute: jest.fn(async () => executeResult),
  };

  return builder;
}

/**
 * Builds a fake TypeORM repository with jest.fn() stubs for every method
 * used by `AuthorizationRequestService`.
 *
 * @returns a repository mock with sensible default resolved values.
 */
export function repoMock<T extends object>(): RepoMock<T> {
  return {
    findOneBy: jest.fn(),
    findOne: jest.fn(async () => null),
    find: jest.fn(async () => []),
    count: jest.fn(async () => 0),
    create: jest.fn((attrs) => attrs),
    save: jest.fn(async (entity) => ({ id: 1, ...entity })),
    update: jest.fn(),
    createQueryBuilder: jest.fn(() => queryBuilderMock({ affected: 1 })),
  } as RepoMock<T>;
}

/**
 * Hashes a value with SHA-256, matching the hashing used to store poll
 * tokens.
 *
 * @param value - the plain-text value to hash.
 * @returns the hex-encoded SHA-256 digest.
 */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Builds a fake, fully populated `AuthorizationRequest` row for service unit
 * specs. A fresh object (and fresh dates) is created on every call.
 *
 * @param overrides - the fields to override on top of the defaults.
 * @returns a complete open `AuthorizationRequest` row.
 */
export function buildFakeAuthorizationRequest(overrides: Partial<AuthorizationRequest> = {}): AuthorizationRequest {
  return {
    id: 10,
    uuid: 'uuid-1',
    username: 'darthjee',
    userId: 1,
    status: 'open',
    pollTokenHash: sha256('poll-token'),
    requestIp: '203.0.113.1',
    requestUserAgent: 'curl/8.0',
    approvedByUserId: null,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60000),
    resolvedAt: null,
    loggedAt: null,
    authorizeFailedAttempts: 0,
    authorizeLockedUntil: null,
    ...overrides,
  };
}

/**
 * The set of collaborators and the service instance built for each test.
 */
export interface AuthorizationRequestServiceTestContext {
  authorizationRequestRepository: RepoMock<AuthorizationRequest>;
  userRepository: RepoMock<User>;
  tokenService: { issueTokens: jest.Mock };
  eventEmitter: { emit: jest.Mock };
  configService: { get: jest.Mock };
  service: AuthorizationRequestService;
}

/**
 * Builds a fresh `AuthorizationRequestService` wired to mocked
 * collaborators, mirroring the production `AuthorizationRequestModule`
 * wiring.
 *
 * @returns the mocked collaborators and the service instance under test.
 */
export function createAuthorizationRequestServiceTestContext(): AuthorizationRequestServiceTestContext {
  const authorizationRequestRepository = repoMock<AuthorizationRequest>();
  const userRepository = repoMock<User>();
  const tokenService = { issueTokens: jest.fn(async (user: User) => ({ user, accessToken: 'jwt', refreshToken: 'rt' })) };
  const eventEmitter = { emit: jest.fn() };
  const configService = { get: jest.fn().mockReturnValue(undefined) };

  const abuseGuard = new AuthorizationRequestAbuseGuardService(
    authorizationRequestRepository as never,
    configService as unknown as ConfigService,
  );

  const service = new AuthorizationRequestService(
    authorizationRequestRepository as never,
    userRepository as never,
    tokenService as unknown as TokenService,
    eventEmitter as unknown as EventEmitter2,
    configService as unknown as ConfigService,
    abuseGuard,
  );

  return { authorizationRequestRepository, userRepository, tokenService, eventEmitter, configService, service };
}

/**
 * Registers a `beforeEach` that builds a fresh service test context for every
 * test, and returns a context object whose members are live getters reading
 * the current test's context. Must be called inside a `describe` (or at the
 * top level of a spec file), never inside a test body.
 *
 * @returns a context object whose properties always reflect the current test.
 */
export function useAuthorizationRequestServiceContext(): AuthorizationRequestServiceTestContext {
  let context: AuthorizationRequestServiceTestContext;

  beforeEach(() => {
    context = createAuthorizationRequestServiceTestContext();
  });

  return {
    get authorizationRequestRepository() {
      return context.authorizationRequestRepository;
    },
    get userRepository() {
      return context.userRepository;
    },
    get tokenService() {
      return context.tokenService;
    },
    get eventEmitter() {
      return context.eventEmitter;
    },
    get configService() {
      return context.configService;
    },
    get service() {
      return context.service;
    },
  };
}

/**
 * Asserts that `create` computed both the per-IP and the per-username open
 * request counts (i.e. it never short-circuited after the first count).
 *
 * @param repo - the repository mock whose `count` was expected to be called.
 * @param repo.count - the `count` mock of the repository.
 * @param ip - the request IP the IP count should have been filtered by.
 * @param username - the username the username count should have been filtered by.
 */
export function expectBothCreateCountsComputed(repo: { count: jest.Mock }, ip: string, username: string): void {
  expect(repo.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ requestIp: ip }) }));
  expect(repo.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ username }) }));
}
