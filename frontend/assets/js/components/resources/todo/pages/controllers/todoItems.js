/**
 * Pure updates of a loaded todo list's `items`, applied from the API's mutation responses so
 * the show page does not refetch the whole list after each item change. Each function returns a
 * new list object and leaves a `null` list (not loaded) untouched.
 */

/**
 * Append a created item; items stay ordered by id.
 *
 * @param {object|null} list - The loaded list.
 * @param {object} item - The created item.
 * @returns {object|null} The updated list.
 */
export function appendItem(list, item) {
  if (!list) {
    return list;
  }

  return { ...list, items: [...list.items, item].sort((a, b) => a.id - b.id) };
}

/**
 * Replace an updated item, matched by id.
 *
 * @param {object|null} list - The loaded list.
 * @param {object} item - The updated item.
 * @returns {object|null} The updated list.
 */
export function replaceItem(list, item) {
  if (!list) {
    return list;
  }

  return { ...list, items: list.items.map((current) => (current.id === item.id ? item : current)) };
}

/**
 * Remove a deleted item, matched by id.
 *
 * @param {object|null} list - The loaded list.
 * @param {number} itemId - The deleted item's id.
 * @returns {object|null} The updated list.
 */
export function removeItem(list, itemId) {
  if (!list) {
    return list;
  }

  return { ...list, items: list.items.filter((item) => item.id !== itemId) };
}
