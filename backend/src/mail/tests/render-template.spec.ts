import { renderTemplate } from '../render-template.js';
import type { TemplateRegistry } from '../template-registry.js';

const registry: TemplateRegistry = Object.freeze({
  greet: Object.freeze({
    subject: 'Hello {{ name }}',
    text: 'Hi {{name}} — code {{code}}',
    html: '<p>Hi {{name}} &amp; co — {{code}}</p>',
  }),
  plain: Object.freeze({ subject: 'Static', text: 'no vars' }),
});

describe('renderTemplate', () => {
  it('interpolates a spaced placeholder into subject, text and html', () => {
    const result = renderTemplate(registry, 'greet', { name: 'Sam', code: '42' });

    expect(result.subject).toBe('Hello Sam');
    expect(result.text).toBe('Hi Sam — code 42');
    expect(result.html).toBe('<p>Hi Sam &amp; co — 42</p>');
  });

  it('inserts values verbatim in subject and text', () => {
    const result = renderTemplate(registry, 'greet', { name: '<b>&"\'', code: 'c' });

    expect(result.subject).toBe('Hello <b>&"\'');
    expect(result.text).toBe('Hi <b>&"\' — code c');
  });

  it('HTML-escapes values in html only', () => {
    const result = renderTemplate(registry, 'greet', { name: '<b>&"\'', code: 'c' });

    expect(result.html).toBe('<p>Hi &lt;b&gt;&amp;&quot;&#39; &amp; co — c</p>');
  });

  it('throws when a referenced variable is missing', () => {
    expect(() => renderTemplate(registry, 'greet', { name: 'Sam' })).toThrow(
      "mail: template 'greet' is missing variable 'code'",
    );
  });

  it('ignores extra keys that no placeholder references', () => {
    const result = renderTemplate(registry, 'greet', { name: 'Sam', code: '1', unused: 'x' });

    expect(result.subject).toBe('Hello Sam');
  });

  it('throws for an unknown template name', () => {
    expect(() => renderTemplate(registry, 'nope', {})).toThrow('mail: unknown template: nope');
  });

  it('omits html entirely when the source template has none', () => {
    const result = renderTemplate(registry, 'plain', {});

    expect('html' in result).toBe(false);
  });
});
