import React from 'react';
import TodoItemsHelper from '../../../../../../../../assets/js/components/resources/todo/pages/helpers/TodoItemsHelper.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

const ITEMS = [{ id: 1, description: 'Milk', done: false }, { id: 2, description: 'Eggs', done: true }];
const ALL = { canManage: true, canDelete: true, canWrite: true };
const READ_ONLY = { canManage: false, canDelete: false, canWrite: false };

const stateWith = (state) => ({
  list: { id: 3, items: ITEMS }, perms: ALL, pending: false, newDescription: '', editing: null, ...state,
});

const flatten = (node, acc = []) => {
  if (Array.isArray(node)) {
    node.forEach((child) => flatten(child, acc));
    return acc;
  }

  if (!node || typeof node !== 'object') {
    return acc;
  }

  acc.push(node);
  return flatten(node.props?.children, acc);
};

describe('TodoItemsHelper', () => {
  let handlers;

  beforeEach(() => {
    handlers = jasmine.createSpyObj('handlers', [
      'onToggleItem', 'onStartEdit', 'onEditChange', 'onSaveEdit', 'onCancelEdit',
      'onDeleteItem', 'onNewDescriptionChange', 'onAddItem',
    ]);
  });

  describe('.renderItems', () => {
    it('strikes through done items', () => {
      const page = renderedOutput(TodoItemsHelper.renderItems(stateWith({}), handlers));

      expect(page.contains('text-decoration-line-through')).toBeTrue();
    });

    it('wires the row controls to the item', () => {
      const nodes = flatten(TodoItemsHelper.renderItems(stateWith({}), handlers));
      const checkbox = nodes.find((node) => node.props?.type === 'checkbox');
      const edit = nodes.find((node) => node.props?.children === 'Edit');
      const remove = nodes.find((node) => node.props?.children === 'Delete');

      checkbox.props.onChange();
      edit.props.onClick();
      remove.props.onClick();

      expect(handlers.onToggleItem).toHaveBeenCalledWith(ITEMS[0]);
      expect(handlers.onStartEdit).toHaveBeenCalledWith(ITEMS[0]);
      expect(handlers.onDeleteItem).toHaveBeenCalledWith(ITEMS[0]);
    });

    it('renders a read-only checkbox for a role that may not write', () => {
      const nodes = flatten(TodoItemsHelper.renderItems(stateWith({ perms: READ_ONLY }), handlers));
      const checkbox = nodes.find((node) => node.props?.type === 'checkbox');

      expect(checkbox.props.disabled).toBeTrue();
      expect(checkbox.props.onChange).toBeUndefined();
    });

    it('renders the inline editor of the edited item, hiding its delete button', () => {
      const page = renderedOutput(TodoItemsHelper.renderItems(
        stateWith({ editing: { id: 1, description: 'Oat milk' } }),
        handlers,
      ));

      expect(page.containsAttribute('id', 'todo-item-edit-1')).toBeTrue();
      expect(page.containsAttribute('value', 'Oat milk')).toBeTrue();
      expect(page.containsElement('button', 'Save')).toBeTrue();
      expect(page.containsInOrder('Oat milk', 'Cancel', 'Eggs', 'Delete')).toBeTrue();
      expect(page.containsInOrder('Delete', 'Eggs')).toBeFalse();
    });

    it('renders the empty state', () => {
      const page = renderedOutput(React.createElement('div', null, TodoItemsHelper.renderItems(
        stateWith({ list: { id: 3, items: [] } }),
        handlers,
      )));

      expect(page.contains('No items yet.')).toBeTrue();
    });
  });

  describe('.renderAddForm', () => {
    it('renders the add form for a role that may write', () => {
      const page = renderedOutput(TodoItemsHelper.renderAddForm(stateWith({ newDescription: 'Bread' }), handlers));

      expect(page.containsAttribute('value', 'Bread')).toBeTrue();
      expect(page.containsElement('button', 'Add item')).toBeTrue();
    });

    it('renders nothing for a role that may not write', () => {
      expect(TodoItemsHelper.renderAddForm(stateWith({ perms: READ_ONLY }), handlers)).toBeNull();
    });
  });
});
