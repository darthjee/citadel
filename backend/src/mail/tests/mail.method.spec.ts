import { NativeEmailMethod } from '../mail.method.js';

const validMessage = {
  from: 'no-reply@citadel-placeholder.local',
  to: 'user@example.com',
  subject: 'Subject line',
  text: 'PLAIN_BODY_SECRET',
  html: '<p>HTML_BODY_SECRET</p>',
};

describe('NativeEmailMethod', () => {
  let sendMail: jest.Mock;
  let transporter: { sendMail: jest.Mock };

  beforeEach(() => {
    sendMail = jest.fn();
    transporter = { sendMail };
  });

  describe('when the send succeeds', () => {
    beforeEach(() => {
      sendMail.mockResolvedValue({ messageId: 'abc', accepted: ['user@example.com'], rejected: [] });
    });

    it('calls transporter.sendMail once with the message fields and resolves with the messageId', async () => {
      const method = new NativeEmailMethod(transporter as never);

      const result = await method.deliver({ ...validMessage });

      expect(sendMail).toHaveBeenCalledTimes(1);
      expect(sendMail).toHaveBeenCalledWith({
        from: 'no-reply@citadel-placeholder.local',
        to: 'user@example.com',
        subject: 'Subject line',
        text: 'PLAIN_BODY_SECRET',
        html: '<p>HTML_BODY_SECRET</p>',
      });
      expect(result).toEqual({ messageId: 'abc' });
    });
  });

  describe('when the recipient is rejected', () => {
    it('rejects with an error naming the rejected recipient', async () => {
      sendMail.mockResolvedValue({ accepted: [], rejected: ['user@example.com'] });
      const method = new NativeEmailMethod(transporter as never);

      await expect(method.deliver({ ...validMessage })).rejects.toThrow('user@example.com');
    });
  });

  describe('when sendMail rejects', () => {
    it('propagates the same error', async () => {
      const error = new Error('transport exploded');
      sendMail.mockRejectedValue(error);
      const method = new NativeEmailMethod(transporter as never);

      await expect(method.deliver({ ...validMessage })).rejects.toBe(error);
    });
  });
});
