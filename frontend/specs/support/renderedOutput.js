import { renderToStaticMarkup } from 'react-dom/server';

/**
 * Renders a React element once and answers questions about the rendered output.
 *
 * @description Renders `element` with `renderToStaticMarkup` a single time and keeps the result
 * private, exposing only boolean queries so specs assert on booleans instead of passing the
 * rendered string around. `containsTag` lets specs check for an element without passing markup
 * literals around, `containsElement` checks an element's full text content the same way,
 * `containsAttribute` checks for an exact `name="value"` attribute pair, and `containsInOrder`
 * checks that several texts appear one after the other, and `isEmpty` checks that nothing was
 * rendered at all.
 * @param {React.ReactElement} element - The element to render.
 * @returns {{contains: Function, containsTag: Function, containsElement: Function,
 *   containsAttribute: Function, containsInOrder: Function, isEmpty: Function}} An object
 *   whose `contains(text)` tells whether the rendered output includes `text`, whose
 *   `containsTag(tagName)` tells whether it includes an opening tag named `tagName`, whose
 *   `containsElement(tagName, text)` tells whether `text` is the full content of an element
 *   named `tagName`, whose `containsAttribute(name, value)` tells whether it includes an
 *   attribute `name` whose value is exactly `value`, whose `containsInOrder(...texts)`
 *   tells whether every text is included, each one starting after the end of the previous one,
 *   and whose `isEmpty()` tells whether nothing was rendered.
 */
export const renderedOutput = (element) => {
  const rendered = renderToStaticMarkup(element);
  const containsInOrder = (...texts) => {
    let from = 0;

    return texts.every((text) => {
      const index = rendered.indexOf(text, from);

      if (index === -1) {
        return false;
      }

      from = index + text.length;
      return true;
    });
  };

  return {
    contains: (text) => rendered.includes(text),
    containsTag: (tagName) => rendered.includes(`<${tagName}`),
    containsElement: (tagName, text) => rendered.includes(`>${text}</${tagName}`),
    containsAttribute: (name, value) => rendered.includes(`${name}="${value}"`),
    containsInOrder,
    isEmpty: () => rendered === '',
  };
};
