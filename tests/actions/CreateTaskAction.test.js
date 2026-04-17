import { beforeEach, describe, expect, it } from '@jest/globals';
import db from '../../src/config/database.js';
import CreateTaskAction from '../../src/actions/tasks/CreateTaskAction.js';

const createTaskAction = new CreateTaskAction();

const resetDatabase = () => {
  db.exec(`
    DELETE FROM user_events;
    DELETE FROM notifications;
    DELETE FROM attachments;
    DELETE FROM task_tags;
    DELETE FROM task_categories;
    DELETE FROM subtasks;
    DELETE FROM tasks;
    DELETE FROM tags;
    DELETE FROM categories;
    DELETE FROM users;
  `);
};

const createUser = () => {
  const result = db.prepare(`
    INSERT INTO users (
      name,
      email,
      password_hash,
      theme_preference,
      onboarding_completed,
      default_priority,
      default_view
    ) VALUES (
      @name,
      @email,
      @password_hash,
      @theme_preference,
      @onboarding_completed,
      @default_priority,
      @default_view
    )
  `).run({
    name: 'Test User',
    email: `user-${Date.now()}-${Math.random()}@example.com`,
    password_hash: '$2b$12$abcdefghijklmnopqrstuv',
    theme_preference: 'system',
    onboarding_completed: 0,
    default_priority: 'medium',
    default_view: 'list',
  });

  return Number(result.lastInsertRowid);
};

const createCategory = (userId, name = 'Work') => {
  const result = db.prepare(`
    INSERT INTO categories (user_id, name, color, icon)
    VALUES (@user_id, @name, @color, @icon)
  `).run({
    user_id: userId,
    name,
    color: '#6750A4',
    icon: 'work',
  });

  return Number(result.lastInsertRowid);
};

describe('CreateTaskAction', () => {
  beforeEach(() => {
    resetDatabase();
  });

  it('creates a task with the correct fields', () => {
    const userId = createUser();

    const task = createTaskAction.execute(userId, {
      title: 'Plan launch',
      description: 'Review release checklist',
      priority: 'high',
      status: 'pending',
      due_date: '2030-01-15',
    });

    expect(task).toMatchObject({
      user_id: userId,
      title: 'Plan launch',
      description: 'Review release checklist',
      priority: 'high',
      status: 'pending',
      due_date: '2030-01-15',
    });
  });

  it('syncs categories correctly', () => {
    const userId = createUser();
    const categoryId = createCategory(userId);

    const task = createTaskAction.execute(userId, {
      title: 'Categorized task',
      priority: 'medium',
      status: 'pending',
      category_ids: [categoryId],
    });

    const assignedCategories = db
      .prepare('SELECT category_id FROM task_categories WHERE task_id = ? ORDER BY category_id ASC')
      .all(task.id)
      .map((row) => Number(row.category_id));

    expect(assignedCategories).toEqual([categoryId]);
    expect(task.categories.map((category) => Number(category.id))).toEqual([categoryId]);
  });

  it('throws if userId is missing', () => {
    expect(() =>
      createTaskAction.execute(null, {
        title: 'Missing user',
        priority: 'medium',
        status: 'pending',
      }),
    ).toThrow('A valid userId is required.');
  });
});
