import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * A todo list, owned by exactly one of a user or an organization (see
 * `docs/agents/modules/todo.md`). Owns table `todo_lists`. `userId` and
 * `organizationId` are logical references to `auth` (no physical FK, no
 * relation); a CHECK constraint enforces that exactly one is set. The owner is
 * only ever set from the request's `OwnerContext`, never from the body. The
 * name is user input and is never logged.
 */
@Entity('todo_lists')
export class TodoList {
  @PrimaryGeneratedColumn()
    id!: number;

  @Column({ type: 'varchar', length: 255 })
    name!: string;

  @Index('idx_todo_lists_user_id')
  @Column({ name: 'user_id', type: 'int', nullable: true })
    userId!: number | null;

  @Index('idx_todo_lists_organization_id')
  @Column({ name: 'organization_id', type: 'int', nullable: true })
    organizationId!: number | null;

  @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
