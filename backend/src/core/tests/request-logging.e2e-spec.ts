import {
  Controller,
  Get,
  INestApplication,
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AdminGuard } from '../admin.guard.js';
import { HttpExceptionFilter } from '../http-exception.filter.js';
import { JwtGuard } from '../jwt.guard.js';
import { LoggerService } from '../logger.service.js';
import { LoggingModule } from '../logging.module.js';
import { Public } from '../public.decorator.js';
import { RequestContextMiddleware } from '../request-context.middleware.js';
import { clearConsoleSpies, createConsoleSpies, restoreConsoleSpies } from './console-spies.test-support.js';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Controller()
class ProbeController {
  private readonly logger: LoggerService;

  constructor(logger: LoggerService) {
    this.logger = logger;
  }

  @Public()
  @Get('health.json')
  health(): { status: string } {
    return { status: 'ok' };
  }

  @Public()
  @Get('ping.json')
  ping(): { ok: boolean } {
    this.logger.info('handler-line');
    return { ok: true };
  }

  @Get('protected.json')
  protectedRoute(): { ok: boolean } {
    return { ok: true };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggingModule,
    JwtModule.register({
      global: true,
      secret: 'test-secret',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [ProbeController],
  providers: [
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_GUARD, useClass: AdminGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
class TestAppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('{*splat}');
  }
}

describe('request logging (e2e)', () => {
  let app: INestApplication;

  const consoleSpies = createConsoleSpies();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [TestAppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterEach(() => {
    clearConsoleSpies(consoleSpies);
  });

  afterAll(async () => {
    restoreConsoleSpies(consoleSpies);
    await app.close();
  });

  /**
   * Returns the args of every `console.info` call whose first argument is the
   * access-log message `'request'`.
   * @returns {unknown[][]} The matching call argument tuples.
   */
  function accessLogCalls(): unknown[][] {
    return consoleSpies.info.mock.calls.filter((call) => call[0] === 'request');
  }

  it('emits exactly one access-log line with the right shape', async () => {
    await request(app.getHttpServer()).get('/health.json').expect(200);

    const calls = accessLogCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toEqual({
      method: 'GET',
      path: '/health.json',
      statusCode: 200,
      requestId: expect.any(String),
    });
  });

  it('uses a UUID v4 requestId', async () => {
    await request(app.getHttpServer()).get('/health.json').expect(200);

    const attributes = accessLogCalls()[0][1] as { requestId: string };
    expect(attributes.requestId).toMatch(UUID_V4);
  });

  it('mints a distinct requestId per request', async () => {
    await request(app.getHttpServer()).get('/health.json').expect(200);
    await request(app.getHttpServer()).get('/health.json').expect(200);

    const calls = accessLogCalls();
    const first = (calls[0][1] as { requestId: string }).requestId;
    const second = (calls[1][1] as { requestId: string }).requestId;
    expect(first).not.toBe(second);
  });

  it('correlates handler log lines with the access-log line of the same request', async () => {
    await request(app.getHttpServer()).get('/ping.json').expect(200);

    const handlerCall = consoleSpies.info.mock.calls.find((call) => call[0] === 'handler-line');
    const accessCall = accessLogCalls()[0];

    expect(handlerCall).toBeDefined();
    const handlerRequestId = (handlerCall?.[1] as { requestId: string }).requestId;
    const accessRequestId = (accessCall[1] as { requestId: string }).requestId;

    expect(handlerRequestId).toBe(accessRequestId);
    expect(handlerRequestId).toMatch(UUID_V4);
  });

  it('logs guard-rejected requests', async () => {
    await request(app.getHttpServer()).get('/protected.json').expect(401);

    const calls = accessLogCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toEqual({
      method: 'GET',
      path: '/protected.json',
      statusCode: 401,
      requestId: expect.any(String),
    });
  });

  it('never logs a request cookie or its secret value', async () => {
    await request(app.getHttpServer())
      .get('/health.json')
      .set('Cookie', 'access_token=super-secret-value')
      .expect(200);

    expect(accessLogCalls()).toHaveLength(1);

    const serialized = consoleSpies.info.mock.calls
      .map((call) => JSON.stringify(call))
      .join('|')
      .toLowerCase();

    expect(serialized).not.toContain('super-secret-value');
    expect(serialized).not.toContain('access_token');
    expect(serialized).not.toContain('cookie');
    expect(serialized).not.toContain('authorization');
  });
});
