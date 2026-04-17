import db from '../config/database.js';
import { buildUpdatePayload, ensureUserId } from './modelHelpers.js';

const subtaskColumns = `
  st.id,
  st.task_id,
  st.title,
  st.is_completed,
  st.position,
  st.created_at,
  st.updated_at
`;

const findSubtaskByIdStatement = db.prepare(`
  SELECT ${subtaskColumns}
  FROM subtasks st
  INNER JOIN tasks t ON t.id = st.task_id
  WHERE st.id = @id
    AND t.user_id = @user_id
  LIMIT 1
`);

const findByTaskIdStatement = db.prepare(`
  SELECT ${subtaskColumns}
  FROM subtasks st
  INNER JOIN tasks t ON t.id = st.task_id
  WHERE st.task_id = @task_id
    AND t.user_id = @user_id
  ORDER BY st.position ASC, st.id ASC
`);

const nextSubtaskPositionStatement = db.prepare(`
  SELECT COALESCE(MAX(st.position), -1) + 1 AS next_position
  FROM subtasks st
  INNER JOIN tasks t ON t.id = st.task_id
  WHERE st.task_id = @task_id
    AND t.user_id = @user_id
`);

const maxSubtaskPositionStatement = db.prepare(`
  SELECT COALESCE(MAX(st.position), -1) AS max_position
  FROM subtasks st
  INNER JOIN tasks t ON t.id = st.task_id
  WHERE st.task_id = @task_id
    AND t.user_id = @user_id
`);

const completionSummaryStatement = db.prepare(`
  SELECT
    COUNT(*) AS total_count,
    COALESCE(SUM(CASE WHEN st.is_completed = 1 THEN 1 ELSE 0 END), 0) AS completed_count
  FROM subtasks st
  INNER JOIN tasks t ON t.id = st.task_id
  WHERE st.task_id = @task_id
    AND t.user_id = @user_id
`);

const createSubtaskStatement = db.prepare(`
  INSERT INTO subtasks (task_id, title, is_completed, position)
  SELECT
    t.id,
    @title,
    @is_completed,
    @position
  FROM tasks t
  WHERE t.id = @task_id
    AND t.user_id = @user_id
`);

const toggleCompleteStatement = db.prepare(`
  UPDATE subtasks
  SET
    is_completed = CASE is_completed WHEN 1 THEN 0 ELSE 1 END,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = @id
    AND task_id IN (
      SELECT id
      FROM tasks
      WHERE user_id = @user_id
    )
`);

const deleteSubtaskStatement = db.prepare(`
  DELETE FROM subtasks
  WHERE id = @id
    AND task_id IN (
      SELECT id
      FROM tasks
      WHERE user_id = @user_id
    )
`);

const deleteByTaskIdStatement = db.prepare(`
  DELETE FROM subtasks
  WHERE task_id IN (
    SELECT id
    FROM tasks
    WHERE id = @task_id
      AND user_id = @user_id
  )
`);

const reorderSubtaskStatement = db.prepare(`
  UPDATE subtasks
  SET position = @position, updated_at = CURRENT_TIMESTAMP
  WHERE id = @id
    AND task_id IN (
      SELECT id
      FROM tasks
      WHERE user_id = @user_id
    )
`);

const completeByTaskIdStatement = db.prepare(`
  UPDATE subtasks
  SET is_completed = 1, updated_at = CURRENT_TIMESTAMP
  WHERE task_id IN (
    SELECT id
    FROM tasks
    WHERE id = @task_id
      AND user_id = @user_id
  )
`);

const update = (id, userId, data) => {
  const scopedUserId = ensureUserId(userId);
  const { assignments, params } = buildUpdatePayload(data, ['title', 'is_completed', 'position']);

  if (assignments.length === 0) {
    return findSubtaskByIdStatement.get({ id, user_id: scopedUserId });
  }

  const statement = db.prepare(`
    UPDATE subtasks
    SET ${assignments.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
      AND task_id IN (
        SELECT id
        FROM tasks
        WHERE user_id = @user_id
      )
  `);

  statement.run({ id, user_id: scopedUserId, ...params });

  return findSubtaskByIdStatement.get({ id, user_id: scopedUserId });
};

const reorder = (subtasksArray, userId) => {
  const scopedUserId = ensureUserId(userId);
  const subtasks = Array.isArray(subtasksArray) ? subtasksArray : [];

  for (const item of subtasks) {
    if (!Number.isInteger(Number(item?.id)) || !Number.isInteger(Number(item?.position))) {
      continue;
    }

    reorderSubtaskStatement.run({
      id: Number(item.id),
      position: Number(item.position),
      user_id: scopedUserId,
    });
  }

  return true;
};

const SubtaskModel = {
  findById(id, userId) {
    return findSubtaskByIdStatement.get({ id, user_id: ensureUserId(userId) });
  },
  findByTaskId(taskId, userId) {
    return findByTaskIdStatement.all({ task_id: taskId, user_id: ensureUserId(userId) });
  },
  getMaxPosition(taskId, userId) {
    return (
      maxSubtaskPositionStatement.get({
        task_id: taskId,
        user_id: ensureUserId(userId),
      })?.max_position ?? -1
    );
  },
  create(data) {
    const userId = ensureUserId(data.user_id);
    const position =
      data.position ??
      nextSubtaskPositionStatement.get({ task_id: data.task_id, user_id: userId })?.next_position ??
      0;
    const result = createSubtaskStatement.run({
      task_id: data.task_id,
      title: data.title,
      is_completed: data.is_completed ?? 0,
      position,
      user_id: userId,
    });

    if (result.changes === 0) {
      return null;
    }

    return findSubtaskByIdStatement.get({ id: Number(result.lastInsertRowid), user_id: userId });
  },
  update,
  toggleComplete(id, userId) {
    const scopedUserId = ensureUserId(userId);
    toggleCompleteStatement.run({ id, user_id: scopedUserId });
    return findSubtaskByIdStatement.get({ id, user_id: scopedUserId });
  },
  delete(id, userId) {
    return deleteSubtaskStatement.run({ id, user_id: ensureUserId(userId) }).changes > 0;
  },
  getCompletionSummary(taskId, userId) {
    return completionSummaryStatement.get({
      task_id: taskId,
      user_id: ensureUserId(userId),
    });
  },
  completeByTaskId(taskId, userId) {
    return completeByTaskIdStatement.run({ task_id: taskId, user_id: ensureUserId(userId) }).changes;
  },
  reorder,
  deleteByTaskId(taskId, userId) {
    return deleteByTaskIdStatement.run({ task_id: taskId, user_id: ensureUserId(userId) }).changes;
  },
};

export default SubtaskModel;
