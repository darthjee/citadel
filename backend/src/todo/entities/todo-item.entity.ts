import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * An item of a {@link TodoList}. Owns table `todo_items`. It has no owner
 * columns: it inherits its owner through its list, so it is only ever looked
 * up by `id` + `listId` within an owner-scoped list. `list_id` is a real FK
 * (`ON DELETE RESTRICT`), declared in the migration. The description is user
 * input and is never logged.
 */
@Entity('todo_items')
export class TodoItem {
  @PrimaryGeneratedColumn()
    id!: number;

  @Index('idx_todo_items_list_id')
  @Column({ name: 'list_id', type: 'int' })
    listId!: number;

  @Column({ type: 'varchar', length: 255 })
    description!: string;

  @Column({ type: 'boolean', default: false })
    done!: boolean;

  @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
