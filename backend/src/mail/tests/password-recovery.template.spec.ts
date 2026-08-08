import { join } from 'node:path';
import { renderTemplate } from '../render-template.js';
import { buildTemplateRegistry } from '../template-registry.js';

const registry = buildTemplateRegistry(join(__dirname, '..', 'templates'));
const resetUrl = 'https://app.example/#/recover-password?token=abc123';

describe('password-recovery template', () => {
  it('is present in the on-disk registry', () => {
    expect(registry).toHaveProperty('password-recovery');
  });

  it('renders the static subject', () => {
    const result = renderTemplate(registry, 'password-recovery', { resetUrl });

    expect(result.subject).toBe('Reset your Citadel Placeholder password');
  });

  it('places the reset URL on a line by itself', () => {
    const result = renderTemplate(registry, 'password-recovery', { resetUrl });

    expect(result.text.split('\n')).toContain(resetUrl);
  });

  it('keeps the single-use reassurance copy', () => {
    const result = renderTemplate(registry, 'password-recovery', { resetUrl });

    expect(result.text).toContain('can only be used once');
  });

  it('keeps the "did not ask" reassurance copy', () => {
    const result = renderTemplate(registry, 'password-recovery', { resetUrl });

    expect(result.text).toContain("If you didn't ask to reset your password");
  });

  it('ships no HTML body', () => {
    const result = renderTemplate(registry, 'password-recovery', { resetUrl });

    expect('html' in result).toBe(false);
  });

  it('throws when the resetUrl variable is missing', () => {
    expect(() => renderTemplate(registry, 'password-recovery', {})).toThrow(
      "mail: template 'password-recovery' is missing variable 'resetUrl'",
    );
  });
});
