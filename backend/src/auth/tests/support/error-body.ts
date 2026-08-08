import request from 'supertest';

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export interface ExpectedErrorBody {
  status: number;
  code: string;
  message?: string;
}

// Asserts `response` carries the standard error body
// `{ error: { code, message }, statusCode, timestamp }` with no `details`
// (i.e. not a `ValidationPipe` failure). `message` is matched exactly when
// given, otherwise only its type is checked.
export function expectErrorBody(response: request.Response, { status, code, message }: ExpectedErrorBody): void {
  expect(response.status).toBe(status);
  expect(response.body).toEqual({
    error: { code, message: message ?? expect.any(String) },
    statusCode: status,
    timestamp: expect.stringMatching(ISO_TIMESTAMP),
  });
}

// Asserts `response` is a `ValidationPipe` failure in the standard error body:
// `400`/`VALIDATION_FAILED`, a non-empty `details` list and a `message` made of
// those details joined with `"; "`.
export function expectValidationErrorBody(response: request.Response): void {
  expect(response.status).toBe(400);
  expect(response.body).toEqual({
    error: { code: 'VALIDATION_FAILED', message: expect.any(String), details: expect.any(Array) },
    statusCode: 400,
    timestamp: expect.stringMatching(ISO_TIMESTAMP),
  });
  expect(response.body.error.details.length).toBeGreaterThan(0);
  expect(response.body.error.message).toBe(response.body.error.details.join('; '));
}
