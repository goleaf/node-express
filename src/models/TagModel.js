import db from '../config/database.js';
import { buildUpdatePayload, ensureUserId, normalizeIntegerIds } from './modelHelpers.js';

const tagColumns = `
  tg.id,
  tg.user_id,
  tg.name,
  tg.color,
  tg.created_at,
  tg.updated_at,
  (
    SELECT COUNT(*)
    FROM task_tags tt
    INNER JOIN tasks t ON t.id = tt.task_id
    WHERE tt.tag_id = tg.id
      AND t.user_id = tg.user_id
      AND t.deleted_at IS NULL
  ) AS task_count
`;

const findByUserIdStatement = db.prepare(`
  SELECT ${tagColumns}
  FROM tags tg
  WHERE tg.user_id = @user_id
  ORDER BY tg.name ASC, tg.id ASC
`);

const findByIdStatement = db.prepare(`
  SELECT ${tagColumns}
  FROM tags tg
  WHERE tg.id = @id
    AND tg.user_id = @user_id
  LIMIT 1
`);

const createTagStatement = db.prepare(`
  INSERT INTO tags (user_id, name, color)
  VALUES (@user_id, @name, @color)
`);

const deleteTagStatement = db.prepare(`
  DELETE FROM tags
  WHERE id = @id
    AND user_id = @user_id
`);

const detachAllFromTaskStatement = db.prepare(`
  DELETE FROM task_tags
  WHERE task_id IN (
    SELECT id
    FROM tasks
    WHERE id = @task_id
      AND user_id = @user_id
  )
`);

const attachTagToTaskStatement = db.prepare(`
  INSERT OR IGNORE INTO task_tags (task_id, tag_id)
  SELECT
    t.id,
    tg.id
  FROM tasks t
  INNER JOIN tags tg ON tg.user_id = t.user_id
  WHERE t.id = @task_id
    AND tg.id = @tag_id
    AND t.user_id = @user_id
`);

const detachTagFromTasksStatement = db.prepare(`
  DELETE FROM task_tags
  WHERE tag_id IN (
    SELECT id
    FROM tags
    WHERE id = @tag_id
      AND user_id = @user_id
  )
`);

const update = (id, userId, data) => {
  const scopedUserId = ensureUserId(userId);
  const { assignments, params } = buildUpdatePayload(data, ['name', 'color']);

  if (assignments.length === 0) {
    return findByIdStatement.get({ id, user_id: scopedUserId });
  }

  const statement = db.prepare(`
    UPDATE tags
    SET ${assignments.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
      AND user_id = @user_id
  `);

  statement.run({ id, user_id: scopedUserId, ...params });

  return findByIdStatement.get({ id, user_id: scopedUserId });
};

const syncTaskTags = (taskId, tagIds, userId) => {
  const scopedUserId = ensureUserId(userId);
  const ids = normalizeIntegerIds(tagIds);

  db.transaction(() => {
    detachAllFromTaskStatement.run({ task_id: taskId, user_id: scopedUserId });

    for (const tagId of ids) {
      attachTagToTaskStatement.run({
        task_id: taskId,
        tag_id: tagId,
        user_id: scopedUserId,
      });
    }
  })();

  return true;
};

const TagModel = {
  findByUserId(userId) {
    return findByUserIdStatement.all({ user_id: ensureUserId(userId) });
  },
  findById(id, userId) {
    return findByIdStatement.get({ id, user_id: ensureUserId(userId) });
  },
  create(data) {
    const userId = ensureUserId(data.user_id);
    const result = createTagStatement.run({
      user_id: userId,
      name: data.name,
      color: data.color ?? null,
    });

    return findByIdStatement.get({ id: Number(result.lastInsertRowid), user_id: userId });
  },
  update,
  delete(id, userId) {
    return deleteTagStatement.run({ id, user_id: ensureUserId(userId) }).changes > 0;
  },
  detachTagFromTasks(tagId, userId) {
    return detachTagFromTasksStatement.run({
      tag_id: tagId,
      user_id: ensureUserId(userId),
    }).changes;
  },
  syncTaskTags,
};

export default TagModel;
