import type { MailConfig } from '../mail.config.js';
import { MailService } from '../mail.service.js';
import type { SendEmailResult } from '../mail.service.js';

const enabledConfig: MailConfig = Object.freeze({
  enabled: true,
  from: 'no-reply@citadel-placeholder.local',
  transport: Object.freeze({
    host: 'smtp.example.com',
    port: 587,
    secure: false,
    requireTLS: true,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  }),
  method: 'native',
});

const disabledConfig: MailConfig = Object.freeze({
  enabled: false,
  from: '',
  transport: null,
  method: 'native',
});

const validParams = {
  to: 'user@example.com',
  subject: 'Subject line',
  body: 'PLAIN_BODY_SECRET',
  html: '<p>HTML_BODY_SECRET</p>',
};

const templates = Object.freeze({
  welcome: Object.freeze({
    subject: 'Hi {{name}}',
    text: 'Body {{name}} PLAIN_BODY_SECRET',
    html: '<p>{{name}} HTML_BODY_SECRET</p>',
  }),
});

const templateParams = {
  to: 'user@example.com',
  template: 'welcome',
  variables: { name: 'Sam' },
};

type EntryPoint = {
  name: string;
  call: (service: MailService, overrides?: Record<string, unknown>) => Promise<SendEmailResult>;
  sentSubject: string;
  skipLogAttr: Record<string, string>;
};

const entryPoints: EntryPoint[] = [
  {
    name: 'sendEmail',
    call: (service, overrides = {}) => service.sendEmail({ ...validParams, ...overrides }),
    sentSubject: 'Subject line',
    skipLogAttr: { subject: 'Subject line' },
  },
  {
    name: 'sendEmailTemplate',
    call: (service, overrides = {}) => service.sendEmailTemplate({ ...templateParams, ...overrides }),
    sentSubject: 'Hi Sam',
    skipLogAttr: { template: 'welcome' },
  },
];

describe('MailService', () => {
  let deliver: jest.Mock;
  let methods: { native: { deliver: jest.Mock } };
  let logger: { debug: jest.Mock; info: jest.Mock; warn: jest.Mock; error: jest.Mock };

  const makeService = (
    config: MailConfig,
    methodsArg: unknown = methods,
    templatesArg: unknown = templates,
  ): MailService =>
    new MailService(config, methodsArg as never, templatesArg as never, logger as never);

  beforeEach(() => {
    deliver = jest.fn();
    methods = { native: { deliver } };
    logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe.each(entryPoints)('$name', ({ call, sentSubject, skipLogAttr }) => {
    describe('when enabled and the delivery succeeds', () => {
      beforeEach(() => {
        deliver.mockResolvedValue({ messageId: 'abc' });
      });

      it('uses the per-call method when params provide one', async () => {
        const otherDeliver = jest.fn().mockResolvedValue({ messageId: 'xyz' });
        const service = makeService(enabledConfig, {
          native: { deliver },
          other: { deliver: otherDeliver },
        });

        const result = await call(service, { method: 'other' });

        expect(deliver).not.toHaveBeenCalled();
        expect(otherDeliver).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ status: 'sent', method: 'other', messageId: 'xyz' });
      });

      it('uses an explicit from address when params provide one', async () => {
        const service = makeService(enabledConfig);

        await call(service, { from: 'alerts@citadel-placeholder.local' });

        expect(deliver).toHaveBeenCalledWith(expect.objectContaining({ from: 'alerts@citadel-placeholder.local' }));
      });

      it('logs a debug line confirming the enabled flag check passed before sending', async () => {
        const service = makeService(enabledConfig);

        await call(service);

        expect(logger.debug).toHaveBeenCalledWith(
          'email enabled; sending',
          expect.objectContaining({
            context: 'MailService',
            to: 'user@example.com',
            subject: sentSubject,
            method: 'native',
          }),
        );
        expect(logger.info).not.toHaveBeenCalled();
        expect(logger.warn).not.toHaveBeenCalled();
      });
    });

    describe('when email is disabled', () => {
      it('skips the send, logs a debug line carrying the method and never touches a method', async () => {
        const service = makeService(disabledConfig);

        const result = await call(service);

        expect(result).toEqual({ status: 'skipped', method: 'native' });
        expect(deliver).not.toHaveBeenCalled();
        expect(logger.debug).toHaveBeenCalledWith(
          'email disabled; skipping send',
          expect.objectContaining({
            context: 'MailService',
            to: 'user@example.com',
            ...skipLogAttr,
            method: 'native',
          }),
        );
      });

      it('still throws for an unknown method even though nothing else would happen', async () => {
        const service = makeService(disabledConfig);

        await expect(call(service, { method: 'carrier-pigeon' })).rejects.toThrow(
          'mail: unknown method: carrier-pigeon',
        );
        expect(deliver).not.toHaveBeenCalled();
      });
    });

    describe('when the method is unknown', () => {
      it('rejects before any delivery attempt', async () => {
        const service = makeService(enabledConfig);

        await expect(call(service, { method: 'carrier-pigeon' })).rejects.toThrow(
          'mail: unknown method: carrier-pigeon',
        );
        expect(deliver).not.toHaveBeenCalled();
      });
    });

    describe('when delivery fails', () => {
      it('does not leak the bodies into the failure log', async () => {
        deliver.mockRejectedValue(new Error('boom'));
        const service = makeService(enabledConfig);

        await expect(call(service)).rejects.toThrow('boom');

        const [, attrs] = logger.error.mock.calls[0] as [string, Record<string, unknown>];
        expect(JSON.stringify(attrs)).not.toContain('PLAIN_BODY_SECRET');
        expect(JSON.stringify(attrs)).not.toContain('HTML_BODY_SECRET');
      });

      it('stringifies a non-Error rejection for the failure log', async () => {
        deliver.mockRejectedValue('plain string failure');
        const service = makeService(enabledConfig);

        await expect(call(service)).rejects.toBe('plain string failure');

        const [, attrs] = logger.error.mock.calls[0] as [string, Record<string, unknown>];
        expect(attrs.reason).toBe('plain string failure');
      });
    });
  });

  describe('sendEmail', () => {
    describe('when enabled and the delivery succeeds', () => {
      beforeEach(() => {
        deliver.mockResolvedValue({ messageId: 'abc' });
      });

      it('calls the resolved method once with the message fields and returns a sent result', async () => {
        const service = makeService(enabledConfig);

        const result = await service.sendEmail({ ...validParams });

        expect(deliver).toHaveBeenCalledTimes(1);
        expect(deliver).toHaveBeenCalledWith({
          from: 'no-reply@citadel-placeholder.local',
          to: 'user@example.com',
          subject: 'Subject line',
          text: 'PLAIN_BODY_SECRET',
          html: '<p>HTML_BODY_SECRET</p>',
        });
        expect(result).toEqual({ status: 'sent', method: 'native', messageId: 'abc' });
      });

      it('falls back to the configured from address when params omit it', async () => {
        const service = makeService(enabledConfig);

        await service.sendEmail({ ...validParams });

        expect(deliver).toHaveBeenCalledWith(expect.objectContaining({ from: 'no-reply@citadel-placeholder.local' }));
      });
    });

    describe('when delivery rejects', () => {
      it('rejects with the same error and logs the method without leaking the bodies', async () => {
        const error = new Error('transport exploded');
        deliver.mockRejectedValue(error);
        const service = makeService(enabledConfig);

        await expect(service.sendEmail({ ...validParams })).rejects.toBe(error);

        expect(logger.error).toHaveBeenCalledTimes(1);
        const [, attrs] = logger.error.mock.calls[0] as [string, Record<string, unknown>];
        expect(attrs.reason).toBe('transport exploded');
        expect(attrs.method).toBe('native');
        expect(JSON.stringify(attrs)).not.toContain('PLAIN_BODY_SECRET');
        expect(JSON.stringify(attrs)).not.toContain('HTML_BODY_SECRET');
        expect(attrs.reason).not.toContain('Error:');
      });
    });

    describe('when the recipient is rejected', () => {
      it('propagates the rejection naming the rejected recipient', async () => {
        deliver.mockRejectedValue(new Error('mail: recipient rejected: user@example.com'));
        const service = makeService(enabledConfig);

        await expect(service.sendEmail({ ...validParams })).rejects.toThrow('user@example.com');
      });
    });

    describe('when the to field is blank', () => {
      it.each([['empty', ''], ['whitespace', '   ']])('rejects without calling deliver (%s)', async (_label, to) => {
        const service = makeService(enabledConfig);

        await expect(service.sendEmail({ ...validParams, to })).rejects.toThrow("mail: 'to' is required");
        expect(deliver).not.toHaveBeenCalled();
      });
    });

    describe('when a header field contains a newline', () => {
      it('rejects via the header-injection guard without calling deliver', async () => {
        const service = makeService(enabledConfig);

        await expect(
          service.sendEmail({ ...validParams, subject: 'Hi\nBcc: evil@example.com' }),
        ).rejects.toThrow('mail: header field contains a newline');
        expect(deliver).not.toHaveBeenCalled();
      });
    });
  });

  describe('sendEmailTemplate', () => {
    describe('when enabled', () => {
      beforeEach(() => {
        deliver.mockResolvedValue({ messageId: 'abc' });
      });

      it('renders the template and delegates to the resolved method', async () => {
        const service = makeService(enabledConfig);

        const result = await service.sendEmailTemplate({ ...templateParams });

        expect(deliver).toHaveBeenCalledTimes(1);
        expect(deliver).toHaveBeenCalledWith({
          from: 'no-reply@citadel-placeholder.local',
          to: 'user@example.com',
          subject: 'Hi Sam',
          text: 'Body Sam PLAIN_BODY_SECRET',
          html: '<p>Sam HTML_BODY_SECRET</p>',
        });
        expect(result).toEqual({ status: 'sent', method: 'native', messageId: 'abc' });
      });

      it('rejects for an unknown template without calling deliver', async () => {
        const service = makeService(enabledConfig);

        await expect(
          service.sendEmailTemplate({ ...templateParams, template: 'nope' }),
        ).rejects.toThrow('mail: unknown template: nope');
        expect(deliver).not.toHaveBeenCalled();
      });

      it('rejects when a referenced variable is missing without calling deliver', async () => {
        const service = makeService(enabledConfig);

        await expect(
          service.sendEmailTemplate({ ...templateParams, variables: {} }),
        ).rejects.toThrow("mail: template 'welcome' is missing variable 'name'");
        expect(deliver).not.toHaveBeenCalled();
      });

      it('applies the header-injection guard to the rendered subject', async () => {
        const service = makeService(enabledConfig);

        await expect(
          service.sendEmailTemplate({
            ...templateParams,
            variables: { name: 'x\nBcc: e@e' },
          }),
        ).rejects.toThrow('mail: header field contains a newline');
        expect(deliver).not.toHaveBeenCalled();
      });
    });

    describe('when email is disabled', () => {
      it('skips before rendering, never rejecting on a would-be missing variable', async () => {
        const service = makeService(disabledConfig);

        const result = await service.sendEmailTemplate({ ...templateParams, variables: {} });

        expect(result).toEqual({ status: 'skipped', method: 'native' });
        expect(deliver).not.toHaveBeenCalled();
      });
    });
  });
});
