import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateTodoItemDto } from '../dto/create-todo-item.dto.js';
import { TodoListNameDto } from '../dto/todo-list-name.dto.js';
import { UpdateTodoItemDto } from '../dto/update-todo-item.dto.js';

type DtoClass = new () => object;

async function errorsFor(dto: DtoClass, body: object): Promise<string[]> {
  const errors = await validate(plainToInstance(dto, body));

  return errors.map((error) => error.property);
}

const TOO_LONG = 'x'.repeat(256);
const MAX = '😀'.repeat(255);

describe('todo DTOs', () => {
  describe('TodoListNameDto', () => {
    it('trims the name', () => {
      expect(plainToInstance(TodoListNameDto, { name: '  Chores ' }).name).toBe('Chores');
    });

    it.each([MAX, 'Chores'])('accepts %p', async (name) => {
      expect(await errorsFor(TodoListNameDto, { name })).toEqual([]);
    });

    it.each([[''], ['   '], [TOO_LONG], ['a\u0007b'], [42], [null], [undefined]])('rejects %p', async (name) => {
      expect(await errorsFor(TodoListNameDto, { name })).toEqual(['name']);
    });
  });

  describe('CreateTodoItemDto', () => {
    it.each([{ description: 'Milk' }, { description: MAX, done: true }, { description: 'Milk', done: false }])(
      'accepts %p',
      async (body) => {
        expect(await errorsFor(CreateTodoItemDto, body)).toEqual([]);
      },
    );

    it.each([{}, { description: '' }, { description: ' ' }, { description: TOO_LONG }, { description: 'a\tb' }])(
      'rejects the description in %p',
      async (body) => {
        expect(await errorsFor(CreateTodoItemDto, body)).toEqual(['description']);
      },
    );

    it.each(['true', 1, 0, null])('rejects done: %p', async (done) => {
      expect(await errorsFor(CreateTodoItemDto, { description: 'Milk', done })).toEqual(['done']);
    });
  });

  describe('UpdateTodoItemDto', () => {
    it.each([{}, { done: false }, { description: 'Eggs' }, { description: MAX, done: true }])(
      'accepts %p (presence is the service\'s rule)',
      async (body) => {
        expect(await errorsFor(UpdateTodoItemDto, body)).toEqual([]);
      },
    );

    it.each([{ description: null }, { description: '' }, { description: TOO_LONG }, { description: 'a\u0000' }])(
      'rejects the description in %p',
      async (body) => {
        expect(await errorsFor(UpdateTodoItemDto, body)).toEqual(['description']);
      },
    );

    it.each([null, 'true', 1])('rejects done: %p', async (done) => {
      expect(await errorsFor(UpdateTodoItemDto, { done })).toEqual(['done']);
    });
  });
});
