import buildShowHandlers from '../../../../../../../../assets/js/components/resources/todo/pages/controllers/showHandlers.js';

const ORG = { kind: 'organization', orgId: 5 };
const ITEM = { id: 1, description: 'a', done: false };
const fakeEvent = () => ({ preventDefault: jasmine.createSpy('preventDefault') });

describe('buildShowHandlers', () => {
  let controller;
  let setters;

  const build = (state = {}) => buildShowHandlers(controller, {
    context: ORG, listId: 3, newDescription: 'new', editing: null, ...state,
  }, setters);

  beforeEach(() => {
    controller = jasmine.createSpyObj('controller', [
      'deleteList', 'toggleItem', 'deleteItem', 'saveDescription', 'addItem',
    ]);
    setters = jasmine.createSpyObj('setters', ['setNewDescription', 'setEditing']);
  });

  it('deletes the list', () => {
    build().onDeleteList();

    expect(controller.deleteList).toHaveBeenCalledWith(ORG, 3);
  });

  it('toggles an item', () => {
    build().onToggleItem(ITEM);

    expect(controller.toggleItem).toHaveBeenCalledWith(ORG, 3, ITEM);
  });

  it('deletes an item', () => {
    build().onDeleteItem(ITEM);

    expect(controller.deleteItem).toHaveBeenCalledWith(ORG, 3, 1);
  });

  it('starts, edits and cancels the inline editor', () => {
    const handlers = build({ editing: { id: 1, description: 'a' } });

    handlers.onStartEdit(ITEM);
    handlers.onEditChange({ target: { value: 'ab' } });
    handlers.onCancelEdit();

    expect(setters.setEditing.calls.allArgs()).toEqual([
      [{ id: 1, description: 'a' }], [{ id: 1, description: 'ab' }], [null],
    ]);
  });

  it('closes the editor once the description is saved', async () => {
    controller.saveDescription.and.resolveTo(true);
    const event = fakeEvent();

    await build({ editing: { id: 1, description: 'z' } }).onSaveEdit(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(controller.saveDescription).toHaveBeenCalledWith(ORG, 3, 1, 'z');
    expect(setters.setEditing).toHaveBeenCalledWith(null);
  });

  it('keeps the editor open when saving fails', async () => {
    controller.saveDescription.and.resolveTo(false);

    await build({ editing: { id: 1, description: '' } }).onSaveEdit(fakeEvent());

    expect(setters.setEditing).not.toHaveBeenCalled();
  });

  it('tracks the new item description', () => {
    build().onNewDescriptionChange({ target: { value: 'milk' } });

    expect(setters.setNewDescription).toHaveBeenCalledWith('milk');
  });

  it('clears the add form once the item is added', async () => {
    controller.addItem.and.resolveTo(true);
    const event = fakeEvent();

    await build().onAddItem(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(controller.addItem).toHaveBeenCalledWith(ORG, 3, 'new');
    expect(setters.setNewDescription).toHaveBeenCalledWith('');
  });

  it('keeps the add form when adding fails', async () => {
    controller.addItem.and.resolveTo(false);

    await build().onAddItem(fakeEvent());

    expect(setters.setNewDescription).not.toHaveBeenCalled();
  });
});
