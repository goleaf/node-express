import db from '../config/database.js';
import { buildUpdatePayload, ensureUserId, normalizeIntegerIds } from './modelHelpers.js';

const categoryColumns = `
  c.id,
  c.user_id,
  c.name,
  c.color,
  c.icon,
  c.created_at,
  c.updated_at,
  (
    SELECT COUNT(*)
    FROM task_categories tc
    INNER JOIN tasks t ON t.id = tc.task_id
    WHERE tc.category_id = c.id
      AND t.user_id = c.user_id
      AND t.deleted_at IS NULL
  ) AS task_count
`;

const findByUserIdStatement = db.prepare(`
  SELECT ${categoryColumns}
  FROM categories c
  WHERE c.user_id = @user_id
  ORDER BY c.name ASC, c.id ASC
`);

const findByIdStatement = db.prepare(`
  SELECT ${categoryColumns}
  FROM categories c
  WHERE c.id = @id
    AND c.user_id = @user_id
  LIMIT 1
`);

const createCategoryStatement = db.prepare(`
  INSERT INTO categories (user_id, name, color, icon)
  VALUES (@user_id, @name, @color, @icon)
`);

const deleteCategoryStatement = db.prepare(`
  DELETE FROM categories
  WHERE id = @id
    AND user_id = @user_id
`);

const attachToTaskStatement = db.prepare(`
  INSERT OR IGNORE INTO task_categories (task_id, category_id)
  SELECT
    t.id,
    c.id
  FROM tasks t
  INNER JOIN categories c ON c.user_id = t.user_id
  WHERE t.id = @task_id
    AND c.id = @category_id
    AND t.user_id = @user_id
`);

const detachFromTaskStatement = db.prepare(`
  DELETE FROM task_categories
  WHERE task_id IN (
      SELECT id
      FROM tasks
      WHERE id = @task_id
        AND user_id = @user_id
    )
    AND category_id IN (
      SELECT id
      FROM categories
      WHERE id = @category_id
        AND user_id = @user_id
    )
`);

const detachAllFromTaskStatement = db.prepare(`
  DELETE FROM task_categories
  WHERE task_id IN (
    SELECT id
    FROM tasks
    WHERE id = @task_id
      AND user_id = @user_id
  )
`);

const detachCategoryFromTasksStatement = db.prepare(`
  DELETE FROM task_categories
  WHERE category_id IN (
    SELECT id
    FROM categories
    WHERE id = @category_id
      AND user_id = @user_id
  )
`);

const syncAttachStatement = db.prepare(`
  INSERT OR IGNORE INTO task_categories (task_id, category_id)
  SELECT
    t.id,
    c.id
  FROM tasks t
  INNER JOIN categories c ON c.user_id = t.user_id
  WHERE t.id = @task_id
    AND c.id = @category_id
    AND t.user_id = @user_id
`);

const update = (id, userId, data) => {
  const scopedUserId = ensureUserId(userId);
  const { assignments, params } = buildUpdatePayload(data, ['name', 'color', 'icon']);

  if (assignments.length === 0) {
    return findByIdStatement.get({ id, user_id: scopedUserId });
  }

  const statement = db.prepare(`
    UPDATE categories
    SET ${assignments.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
      AND user_id = @user_id
  `);

  statement.run({ id, user_id: scopedUserId, ...params });

  return findByIdStatement.get({ id, user_id: scopedUserId });
};

const syncTaskCategories = (taskId, categoryIds, userId) => {
  const scopedUserId = ensureUserId(userId);
  const ids = normalizeIntegerIds(categoryIds);

  db.transaction(() => {
    detachAllFromTaskStatement.run({ task_id: taskId, user_id: scopedUserId });

    for (const categoryId of ids) {
      syncAttachStatement.run({
        task_id: taskId,
        category_id: categoryId,
        user_id: scopedUserId,
      });
    }
  })();

  return true;
};

const CategoryModel = {
  findByUserId(userId) {
    return findByUserIdStatement.all({ user_id: ensureUserId(userId) });
  },
  findById(id, userId) {
    return findByIdStatement.get({ id, user_id: ensureUserId(userId) });
  },
  create(data) {
    const userId = ensureUserId(data.user_id);
    const result = createCategoryStatement.run({
      user_id: userId,
      name: data.name,
      color: data.color ?? null,
      icon: data.icon ?? null,
    });

    return findByIdStatement.get({ id: Number(result.lastInsertRowid), user_id: userId });
  },
  update,
  delete(id, userId) {
    return deleteCategoryStatement.run({ id, user_id: ensureUserId(userId) }).changes > 0;
  },
  attachToTask(taskId, categoryId, userId) {
    return attachToTaskStatement.run({
      task_id: taskId,
      category_id: categoryId,
      user_id: ensureUserId(userId),
    }).changes > 0;
  },
  detachFromTask(taskId, categoryId, userId) {
    return detachFromTaskStatement.run({
      task_id: taskId,
      category_id: categoryId,
      user_id: ensureUserId(userId),
    }).changes > 0;
  },
  detachAllFromTask(taskId, userId) {
    return detachAllFromTaskStatement.run({ task_id: taskId, user_id: ensureUserId(userId) }).changes;
  },
  detachCategoryFromTasks(categoryId, userId) {
    return detachCategoryFromTasksStatement.run({
      category_id: categoryId,
      user_id: ensureUserId(userId),
    }).changes;
  },
  syncTaskCategories,
};

export default CategoryModel;
