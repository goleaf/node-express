import db from '../../config/database.js';

const findOwnedTaskStatement = db.prepare(`
  SELECT id
  FROM tasks
  WHERE id = ?
    AND user_id = ?
  LIMIT 1
`);

const normalizeIds = (values) => {
  if (!Array.isArray(values)) {
    return [];
  }

  return [...new Set(values.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];
};

const getSessionUserId = (req) => {
  const userId = Number(req.session?.userId);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error('Authentication is required.');
  }

  return userId;
};

const countOwnedRecordsByIds = (tableName, ids, userId) => {
  const normalizedIds = normalizeIds(ids);

  if (normalizedIds.length === 0) {
    return 0;
  }

  const placeholders = normalizedIds.map(() => '?').join(', ');
  const statement = db.prepare(`
    SELECT COUNT(*) AS total
    FROM ${tableName}
    WHERE user_id = ?
      AND id IN (${placeholders})
  `);

  return Number(statement.get(userId, ...normalizedIds)?.total ?? 0);
};

const countOwnedTasksByIds = (taskIds, userId) => {
  const normalizedTaskIds = normalizeIds(taskIds);

  if (normalizedTaskIds.length === 0) {
    return 0;
  }

  const placeholders = normalizedTaskIds.map(() => '?').join(', ');
  const statement = db.prepare(`
    SELECT COUNT(*) AS total
    FROM tasks
    WHERE user_id = ?
      AND id IN (${placeholders})
  `);

  return Number(statement.get(userId, ...normalizedTaskIds)?.total ?? 0);
};

const normalizeDateBoundary = (value, boundary) => {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    const suffix = boundary === 'end' ? 'T23:59:59.999' : 'T00:00:00.000';
    return new Date(`${value.trim()}${suffix}`);
  }

  return new Date(value);
};

const startOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const validateOwnedCategoryIds = (categoryIds, req) => {
  if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
    return true;
  }

  const userId = getSessionUserId(req);
  const normalizedCategoryIds = normalizeIds(categoryIds);
  const ownedCount = countOwnedRecordsByIds('categories', normalizedCategoryIds, userId);

  if (ownedCount !== normalizedCategoryIds.length) {
    throw new Error('One or more categories do not belong to the current user.');
  }

  return true;
};

const validateOwnedTagIds = (tagIds, req) => {
  if (!Array.isArray(tagIds) || tagIds.length === 0) {
    return true;
  }

  const userId = getSessionUserId(req);
  const normalizedTagIds = normalizeIds(tagIds);
  const ownedCount = countOwnedRecordsByIds('tags', normalizedTagIds, userId);

  if (ownedCount !== normalizedTagIds.length) {
    throw new Error('One or more tags do not belong to the current user.');
  }

  return true;
};

const validateOwnedTaskIds = (taskIds, req) => {
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return true;
  }

  const userId = getSessionUserId(req);
  const normalizedTaskIds = normalizeIds(taskIds);
  const ownedCount = countOwnedTasksByIds(normalizedTaskIds, userId);

  if (ownedCount !== normalizedTaskIds.length) {
    throw new Error('One or more tasks do not belong to the current user.');
  }

  return true;
};

const validateDueDateIsTodayOrFuture = (dueDate) => {
  if (!dueDate) {
    return true;
  }

  const parsedDueDate = normalizeDateBoundary(dueDate, 'start');

  if (Number.isNaN(parsedDueDate.getTime())) {
    return true;
  }

  if (parsedDueDate < startOfToday()) {
    throw new Error('Due date must be today or in the future.');
  }

  return true;
};

const validateReminderBeforeDueDate = (reminderAt, dueDate) => {
  if (!reminderAt || !dueDate) {
    return true;
  }

  const parsedReminderAt = normalizeDateBoundary(reminderAt, 'start');
  const parsedDueDate = normalizeDateBoundary(dueDate, 'end');

  if (Number.isNaN(parsedReminderAt.getTime()) || Number.isNaN(parsedDueDate.getTime())) {
    return true;
  }

  if (parsedReminderAt >= parsedDueDate) {
    throw new Error('Reminder must be before the due date.');
  }

  return true;
};

const validateOwnedTaskParam = (taskId, req) => {
  const userId = getSessionUserId(req);
  const task = findOwnedTaskStatement.get(Number(taskId), userId);

  if (!task) {
    throw new Error('Task does not exist or is not accessible.');
  }

  return true;
};

export {
  validateDueDateIsTodayOrFuture,
  validateOwnedCategoryIds,
  validateOwnedTagIds,
  validateOwnedTaskIds,
  validateOwnedTaskParam,
  validateReminderBeforeDueDate,
};
