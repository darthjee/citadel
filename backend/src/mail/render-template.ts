import type { RawTemplate, TemplateRegistry } from './template-registry.js';

/**
 * The interpolated output of {@link renderTemplate}: `subject` and `text`
 * substituted verbatim, `html` substituted with HTML-escaped values and
 * present only when the source template carried a `body.html`.
 */
export interface RenderedTemplate {
  subject: string;
  text: string;
  html?: string;
}

const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

const HTML_ESCAPES = new Map<string, string>([
  ['&', '&amp;'],
  ['<', '&lt;'],
  ['>', '&gt;'],
  ['"', '&quot;'],
  ["'", '&#39;'],
]);
const HTML_ESCAPE_PATTERN = /[&<>"']/g;

/**
 * HTML-escapes a substituted value in a single pass, looking up each
 * matched character's entity in {@link HTML_ESCAPES}.
 * @param {string} value - The raw substitution value.
 * @returns {string} The value with `& < > " '` replaced by entities.
 */
function escapeHtml(value: string): string {
  // `HTML_ESCAPE_PATTERN` only ever matches one of the five characters held
  // in `HTML_ESCAPES`, so this lookup is guaranteed to hit.
  return value.replace(HTML_ESCAPE_PATTERN, (char) => HTML_ESCAPES.get(char) as string);
}

/**
 * Substitutes every `{{ name }}` placeholder in `text` from `variables`.
 * @param {string} text - The raw template string.
 * @param {Record<string, string>} variables - The substitution map.
 * @param {boolean} escape - Whether to HTML-escape each substituted value.
 * @param {string} templateName - The template name, for error messages.
 * @returns {string} The interpolated string.
 * @throws {Error} When a referenced placeholder has no own key in `variables`.
 */
function interpolate(
  text: string,
  variables: Record<string, string>,
  escape: boolean,
  templateName: string,
): string {
  const variablesMap = new Map(Object.entries(variables));

  return text.replace(PLACEHOLDER, (_match, key: string) => {
    if (!variablesMap.has(key)) {
      throw new Error(`mail: template '${templateName}' is missing variable '${key}'`);
    }

    // `variablesMap.has(key)` above guarantees this lookup hits; TypeScript's
    // control-flow analysis can't link a `Map.has` check to a later
    // `Map.get` the way it can for `in`/plain-object narrowing.
    const value = variablesMap.get(key) as string;

    return escape ? escapeHtml(value) : value;
  });
}

/**
 * Renders one raw template from `registry` against `variables`. `subject`
 * and `text` are interpolated verbatim; `html` is interpolated with each
 * substituted value HTML-escaped and is only present when the raw template
 * had a `body.html`. Pure — the registry is passed in, so no `fs` or env
 * access happens here.
 * @param {TemplateRegistry} registry - The frozen raw template registry.
 * @param {string} templateName - The template directory name to render.
 * @param {Record<string, string>} variables - The substitution map;
 *   unreferenced extra keys are ignored.
 * @returns {RenderedTemplate} The interpolated subject/text (and html when
 *   the template defines one).
 * @throws {Error} When `templateName` is unknown or a referenced
 *   placeholder has no matching key in `variables`.
 */
export function renderTemplate(
  registry: TemplateRegistry,
  templateName: string,
  variables: Record<string, string>,
): RenderedTemplate {
  const registryMap = new Map<string, RawTemplate>(Object.entries(registry));
  const raw = registryMap.get(templateName);

  if (!raw) {
    throw new Error(`mail: unknown template: ${templateName}`);
  }

  const rendered: RenderedTemplate = {
    subject: interpolate(raw.subject, variables, false, templateName),
    text: interpolate(raw.text, variables, false, templateName),
  };

  if ('html' in raw && raw.html !== undefined) {
    rendered.html = interpolate(raw.html, variables, true, templateName);
  }

  return rendered;
}
