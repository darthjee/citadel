import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TodoItem } from './entities/todo-item.entity.js';
import { TodoList } from './entities/todo-list.entity.js';
import { TodoController } from './todo.controller.js';
import { TodoService } from './todo.service.js';

/**
 * The Todo example module: lists and items owned by a user or an
 * organization (see `docs/agents/modules/todo.md`). Owns the `todo_lists`
 * and `todo_items` tables; it reads nothing from other modules — the owner
 * comes from Core's `OwnerContext`, resolved by `OwnerContextGuard`.
 */
@Module({
  imports: [TypeOrmModule.forFeature([TodoList, TodoItem])],
  controllers: [TodoController],
  providers: [TodoService],
})
export class TodoModule {}
