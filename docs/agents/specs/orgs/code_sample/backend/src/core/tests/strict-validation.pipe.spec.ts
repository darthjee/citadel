import { Body, Controller, INestApplication, Post, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsString, MaxLength } from 'class-validator';
import request from 'supertest';
import { StrictBody, StrictValidationPipe } from '../strict-validation.pipe.js';

class NameDto {
  @IsString()
  @MaxLength(5)
    name!: string;
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
    app = moduleRef.createNestApplication();
    // Same global pipe as `main.ts`: it must leave `@StrictBody()` parameters alone.
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
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
});
