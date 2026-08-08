import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Raw, pre-interpolation content of one on-disk email template, read from
 * `templates/<name>/`. `subject` comes from `subject.txt` (single trailing
 * newline stripped), `text` from `body.txt` verbatim, and `html` from
 * `body.html` verbatim when that file exists — otherwise the key is absent.
 */
export interface RawTemplate {
  subject: string;
  text: string;
  html?: string;
}

/**
 * The frozen registry of {@link RawTemplate}s keyed by template directory
 * name, built once at boot by {@link buildTemplateRegistry}.
 */
export type TemplateRegistry = Readonly<Record<string, RawTemplate>>;

/**
 * The known set of files read from a single template directory.
 */
type TemplateFileName = 'subject.txt' | 'body.txt' | 'body.html';

/**
 * The single, guarded place where a template file's path is resolved and its
 * content is read. Every `existsSync`/`readFileSync` pair in this module
 * routes through this function.
 * @param {string} dir - Absolute path to the template directory.
 * @param {TemplateFileName} file - The template file name to read.
 * @returns {string | undefined} The file content, or `undefined` when the
 *   file does not exist.
 * @throws {Error} When the resolved path escapes `dir`.
 */
export function readTemplateFile(dir: string, file: TemplateFileName): string | undefined {
  const path = join(dir, file);

  if (!path.startsWith(join(dir, '.'))) {
    throw new Error(`mail: resolved template path escapes '${dir}'`);
  }

  return existsSync(path) ? readFileSync(path, 'utf8') : undefined;
}

/**
 * Reads one template directory into a frozen {@link RawTemplate}.
 * @param {string} dir - Absolute path to the template directory.
 * @param {string} name - The template directory name, for error messages.
 * @returns {RawTemplate} The frozen raw template content.
 * @throws {Error} When `subject.txt` or `body.txt` is missing.
 */
function readTemplateDir(dir: string, name: string): RawTemplate {
  const subject = readTemplateFile(dir, 'subject.txt');
  const text = readTemplateFile(dir, 'body.txt');
  const html = readTemplateFile(dir, 'body.html');

  if (subject === undefined) {
    throw new Error(`mail: template '${name}' is missing subject.txt`);
  }

  if (text === undefined) {
    throw new Error(`mail: template '${name}' is missing body.txt`);
  }

  const template: RawTemplate = {
    subject: subject.replace(/\r?\n$/, ''),
    text,
  };

  if (html !== undefined) {
    template.html = html;
  }

  return Object.freeze(template);
}

/**
 * Scans `templatesDir` for `<name>/` subdirectories and builds the frozen
 * raw template registry. Directories only are considered; a missing
 * `templatesDir` yields an empty frozen registry. Pure with respect to the
 * environment — takes the directory as a parameter and touches neither
 * `import.meta` nor `process`.
 * @param {string} templatesDir - Absolute path to the templates root.
 * @returns {TemplateRegistry} The frozen registry keyed by template name.
 * @throws {Error} When a template directory is missing `subject.txt` or
 *   `body.txt`.
 */
export function buildTemplateRegistry(templatesDir: string): TemplateRegistry {
  if (!existsSync(templatesDir)) {
    return Object.freeze({});
  }

  const registry: Record<string, RawTemplate> = {};

  for (const entry of readdirSync(templatesDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      registry[entry.name] = readTemplateDir(join(templatesDir, entry.name), entry.name);
    }
  }

  return Object.freeze(registry);
}
