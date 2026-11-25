import { appendItem, removeItem, replaceItem } from '../../../../../../../../assets/js/components/resources/todo/pages/controllers/todoItems.js';

const LIST = { id: 1, name: 'L', items: [{ id: 2, done: false }, { id: 5, done: false }] };

describe('todoItems', () => {
  it('appends an item, keeping the id order', () => {
    expect(appendItem(LIST, { id: 3 }).items.map(({ id }) => id)).toEqual([2, 3, 5]);
  });

  it('replaces an item by id', () => {
    expect(replaceItem(LIST, { id: 5, done: true }).items).toEqual([{ id: 2, done: false }, { id: 5, done: true }]);
  });

  it('removes an item by id', () => {
    expect(removeItem(LIST, 2).items).toEqual([{ id: 5, done: false }]);
  });

  it('does not mutate the list', () => {
    appendItem(LIST, { id: 9 });

    expect(LIST.items.length).toBe(2);
  });

  [appendItem, replaceItem, removeItem].forEach((update) => {
    it(`leaves a null list untouched (${update.name})`, () => {
      expect(update(null, { id: 1 })).toBeNull();
    });
  });
});
