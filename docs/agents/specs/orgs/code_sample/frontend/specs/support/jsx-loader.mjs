/**
 * Node.js loader for Jasmine tests.
 * Transforms JSX modules with Babel, stubs CSS imports, and shims
 * `import.meta.env` (which Vite populates at build/dev time, but plain
 * Node never does) from `process.env` for modules that read it.
 */

import { transformSync } from '@babel/core';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];

/**
 * Absolute path of the frontend project root, derived from this loader's own location.
 *
 * @type {string}
 */
export const FRONTEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Reads a module's source, refusing any file outside the frontend project root.
 *
 * @description Converts the `file:` URL to a normalized filesystem path and reads it only
 *   when it lies strictly inside {@link FRONTEND_ROOT}. The separator is appended to the
 *   prefix check so a sibling directory sharing the root's name prefix is rejected.
 * @param {string} url - The `file:` URL of the module to read.
 * @returns {{filePath: string, source: string}} The resolved path and the file's contents.
 * @throws {Error} When the resolved path is outside the frontend root.
 */
export function readSource(url) {
  const filePath = path.resolve(fileURLToPath(url));
  if (!filePath.startsWith(FRONTEND_ROOT + path.sep)) {
    throw new Error(`Refusing to read outside the frontend root: ${filePath}`);
  }
  return { filePath, source: readFileSync(filePath, 'utf-8') };
}

/**
 * Resolve hook for the Node.js module loader.
 *
 * @param {string} specifier - The module specifier.
 * @param {object} context - The resolution context.
 * @param {Function} nextResolve - The next resolve function.
 * @returns {Promise<object>} The resolved module.
 */
export async function resolve(specifier, context, nextResolve) {
  if (IMAGE_EXTENSIONS.some((ext) => specifier.endsWith(ext))) {
    // Return a synthetic URL so the load hook can intercept it without Node trying to find the file.
    return { url: `stub:image:${specifier.split('/').pop()}`, shortCircuit: true };
  }
  if (specifier.endsWith('?raw')) {
    // Vite resolves `?raw` imports to the file's text contents; replicate that for Node-based specs.
    const resolved = await nextResolve(specifier.slice(0, -'?raw'.length), context);
    return { ...resolved, url: `${resolved.url}?raw`, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

/**
 * Transforms a `.jsx` file into plain JavaScript via Babel.
 *
 * @param {string} url - The `file:` URL of the `.jsx` module.
 * @returns {{format: string, source: string, shortCircuit: boolean}} The transformed module.
 */
function loadJsx(url) {
  const { filePath, source } = readSource(url);
  const transformed = transformSync(source, {
    filename: filePath,
    presets: [
      ['@babel/preset-react', { runtime: 'automatic' }],
    ],
    sourceType: 'module',
  });
  return {
    format: 'module',
    source: transformed.code,
    shortCircuit: true,
  };
}

/**
 * Shims `import.meta.env` from `process.env` for plain `.js` modules that read it. Vite
 * statically replaces `import.meta.env.VITE_*` at build/dev time, but plain Node never
 * populates `import.meta.env`.
 *
 * @param {string} filePath - The absolute filesystem path of the `.js` file.
 * @param {string} source - The file's source code.
 * @returns {{format: string, source: string, shortCircuit: boolean}|null} The shimmed module,
 *   or `null` when the source doesn't reference `import.meta.env`.
 */
function shimImportMetaEnv(filePath, source) {
  if (!source.includes('import.meta.env')) {
    return null;
  }
  return {
    format: 'module',
    source: `import.meta.env = import.meta.env ?? { ...process.env };\n${source}`,
    shortCircuit: true,
  };
}

/**
 * Load hook for the Node.js module loader.
 * Transforms JSX files to plain JavaScript.
 *
 * @param {string} url - The module URL.
 * @param {object} context - The load context.
 * @param {Function} nextLoad - The next load function.
 * @returns {Promise<object>} The loaded and transformed module source.
 */
export async function load(url, context, nextLoad) {
  if (url.endsWith('?raw')) {
    const { source } = readSource(url.slice(0, -'?raw'.length));
    return {
      format: 'module',
      source: `export default ${JSON.stringify(source)};`,
      shortCircuit: true,
    };
  }
  if (url.endsWith('.jsx')) {
    return loadJsx(url);
  }
  if (url.endsWith('.css') || url.endsWith('.scss')) {
    // Frontend entrypoints import stylesheets, but Node-based specs only need the JS module graph.
    return {
      format: 'module',
      source: 'export default {};',
      shortCircuit: true,
    };
  }
  if (url.startsWith('stub:image:')) {
    // Static image imports are resolved by Vite at build time; return a fixed filename stub for specs.
    const filename = url.slice('stub:image:'.length);
    return {
      format: 'module',
      source: `export default '${filename}';`,
      shortCircuit: true,
    };
  }
  const [bareUrl] = url.split('?');
  if (bareUrl.endsWith('.js') && !bareUrl.includes('/node_modules/')) {
    const { filePath, source } = readSource(bareUrl);
    const shimmed = shimImportMetaEnv(filePath, source);
    if (shimmed) {
      return shimmed;
    }
  }
  return nextLoad(url, context);
}
