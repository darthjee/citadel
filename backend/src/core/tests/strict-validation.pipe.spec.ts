import { Body, Controller, INestApplication, Module, Post, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Type } from 'class-transformer';
import { IsObject, IsString, MaxLength, ValidateNested } from 'class-validator';
import request from 'supertest';
import { HttpExceptionFilter } from '../http-exception.filter.js';
import { LoggingModule } from '../logging.module.js';
import { StrictBody, StrictValidationPipe } from '../strict-validation.pipe.js';

class NameDto {
  @IsString()
  @MaxLength(5)
    name!: string;
}

class ValidatedParentDto {
  @ValidateNested()
  @Type(() => NameDto)
    child!: NameDto;
}

class UnvalidatedParentDto {
  @IsObject()
    child!: NameDto;
}

@Controller('strict')
class StrictController {
  @Post('strict.json')
  strict(@StrictBody() dto: NameDto): { isDto: boolean; dto: NameDto } {
    return { isDto: dto instanceof NameDto, dto };
  }

  @Post('plain.json')
  plain(@Body() dto: NameDto): NameDto {
    return dto;
  }

  @Post('nested-validated.json')
  nestedValidated(@StrictBody() dto: ValidatedParentDto): ValidatedParentDto {
    return dto;
  }

  @Post('nested-unvalidated.json')
  nestedUnvalidated(@StrictBody() dto: UnvalidatedParentDto): UnvalidatedParentDto {
    return dto;
  }
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), LoggingModule],
  controllers: [StrictController],
  providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
})
class FilteredTestAppModule {}

/**
 * Builds a test app with the same global pipe as `main.ts`.
 * @param {INestApplication} app - The app to configure.
 * @returns {Promise<INestApplication>} The initialised app.
 */
async function initWithGlobalPipe(app: INestApplication): Promise<INestApplication> {
  // Same global pipe as `main.ts`: it must leave `@StrictBody()` parameters alone.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}

describe('StrictValidationPipe', () => {
  it('rejects unknown fields with a 400', async () => {
    const pipe = new StrictValidationPipe();

    await expect(
      pipe.transform({ name: 'ok', role: 'owner' }, { type: 'custom', metatype: NameDto }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('transforms a valid body into the DTO', async () => {
    const pipe = new StrictValidationPipe();
    const result = await pipe.transform({ name: 'ok' }, { type: 'custom', metatype: NameDto });

    expect(result).toBeInstanceOf(NameDto);
    expect(result).toEqual({ name: 'ok' });
  });
});

describe('@StrictBody()', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [StrictController] }).compile();
    app = await initWithGlobalPipe(moduleRef.createNestApplication());
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('answers 400 for an unknown field', async () => {
    const response = await request(app.getHttpServer())
      .post('/strict/strict.json')
      .send({ name: 'ok', organizationId: 1 });

    expect(response.status).toBe(400);
    expect(response.body.message).toEqual(['property organizationId should not exist']);
  });

  it('answers 400 for an invalid field', async () => {
    const response = await request(app.getHttpServer()).post('/strict/strict.json').send({ name: 'too-long' });

    expect(response.status).toBe(400);
  });

  it('passes a valid body through, transformed into the DTO', async () => {
    const response = await request(app.getHttpServer()).post('/strict/strict.json').send({ name: 'ok' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ isDto: true, dto: { name: 'ok' } });
  });

  it('leaves the global pipe stripping unknown fields on plain @Body()', async () => {
    const response = await request(app.getHttpServer())
      .post('/strict/plain.json')
      .send({ name: 'ok', organizationId: 1 });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ name: 'ok' });
  });

  describe('with a missing or empty body', () => {
    it('answers 400 when no body is sent', async () => {
      const response = await request(app.getHttpServer()).post('/strict/strict.json');

      expect(response.status).toBe(400);
    });

    it('answers 400 for an empty JSON object', async () => {
      const response = await request(app.getHttpServer()).post('/strict/strict.json').send({});

      expect(response.status).toBe(400);
    });
  });

  describe('with a non-object JSON body', () => {
    // Arrays reach the pipe and fail DTO validation (`property 0 should not
    // exist`, `name must be a string`); top-level primitives never reach it:
    // Express's strict JSON parser already answers 400 for them.
    it.each([
      ['an empty array', '[]'],
      ['an array of valid objects', '[{"name":"ok"}]'],
      ['a string', '"ok"'],
      ['a number', '1'],
    ])('answers 400 for %s', async (_label, raw) => {
      const response = await request(app.getHttpServer())
        .post('/strict/strict.json')
        .set('Content-Type', 'application/json')
        .send(raw);

      expect(response.status).toBe(400);
    });
  });

  describe('with nested objects', () => {
    it('answers 400 for an unknown nested field when the child is @ValidateNested() + @Type()', async () => {
      const response = await request(app.getHttpServer())
        .post('/strict/nested-validated.json')
        .send({ child: { name: 'ok', role: 'owner' } });

      expect(response.status).toBe(400);
      expect(response.body.message).toEqual(['child.property role should not exist']);
    });

    it('passes a valid nested child through', async () => {
      const response = await request(app.getHttpServer())
        .post('/strict/nested-validated.json')
        .send({ child: { name: 'ok' } });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ child: { name: 'ok' } });
    });

    // Pinned caveat: without @ValidateNested() + @Type(), the nested object is
    // never walked, so its unknown fields are neither rejected nor stripped.
    it('lets unknown nested fields through when the child is not @ValidateNested()', async () => {
      const response = await request(app.getHttpServer())
        .post('/strict/nested-unvalidated.json')
        .send({ child: { name: 'ok', role: 'owner' } });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ child: { name: 'ok', role: 'owner' } });
    });
  });

  describe('validation count', () => {
    it('runs the strict pipe once per request, and class-validator once', async () => {
      const transformSpy = jest.spyOn(StrictValidationPipe.prototype, 'transform');
      const validateSpy = jest.spyOn(
        ValidationPipe.prototype as unknown as { validate: (...args: unknown[]) => unknown },
        'validate',
      );

      const response = await request(app.getHttpServer()).post('/strict/strict.json').send({ name: 'ok' });

      expect(response.status).toBe(201);
      expect(transformSpy).toHaveBeenCalledTimes(1);
      expect(validateSpy).toHaveBeenCalledTimes(1);
    });
  });
});

describe('@StrictBody() through HttpExceptionFilter', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [FilteredTestAppModule] }).compile();
    app = await initWithGlobalPipe(moduleRef.createNestApplication());
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers the standard VALIDATION_FAILED body for an unknown field', async () => {
    const response = await request(app.getHttpServer())
      .post('/strict/strict.json')
      .send({ name: 'ok', organizationId: 1 });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'property organizationId should not exist',
        details: ['property organizationId should not exist'],
      },
      statusCode: 400,
      timestamp: expect.any(String),
    });
  });
});
