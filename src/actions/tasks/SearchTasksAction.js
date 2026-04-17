import db from '../../config/database.js';

const PER_PAGE = 15;
const allowedStatuses = new Set(['pending', 'in_progress', 'completed', 'cancelled']);
const allowedPriorities = new Set(['low', 'medium', 'high', 'urgent']);
const allowedSortFields = new Set(['due_date', 'priority', 'created_at', 'title', 'position']);
const allowedSortDirections = new Set(['asc', 'desc']);

const normalizeInteger = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeString = (value, allowedValues = null) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (allowedValues && !allowedValues.has(trimmed)) {
    return null;
  }

  return trimmed;
};

const buildOrderBy = (sortBy, sortDirection) => {
  const direction = sortDirection === 'asc' ? 'ASC' : 'DESC';

  switch (sortBy) {
    case 'due_date':
      return `tasks.due_date ${direction}, tasks.position ASC, tasks.id ASC`;
    case 'priority':
      return `
        CASE tasks.priority
          WHEN 'urgent' THEN 4
          WHEN 'high' THEN 3
          WHEN 'medium' THEN 2
          ELSE 1
        END ${direction},
        tasks.position ASC,
        tasks.id ASC
      `;
    case 'created_at':
      return `tasks.created_at ${direction}, tasks.id DESC`;
    case 'title':
      return `tasks.title COLLATE NOCASE ${direction}, tasks.id ASC`;
    case 'position':
    default:
      return `tasks.position ${direction}, tasks.id ASC`;
  }
};

const buildTaskIdParams = (taskIds) => {
  const params = {};
  const placeholders = taskIds.map((taskId, index) => {
    const key = `taskId${index}`;
    params[key] = taskId;
    return `@${key}`;
  });

  return {
    placeholders: placeholders.join(', '),
    params,
  };
};

export default class SearchTasksAction {
  execute(userId, filters = {}) {
    const whereClauses = ['tasks.user_id = @userId', 'tasks.deleted_at IS NULL'];
    const params = { userId };

    const queryText = normalizeString(filters.query);
    const filterStatus = normalizeString(filters.filter_status, allowedStatuses);
    const filterPriority = normalizeString(filters.filter_priority, allowedPriorities);
    const filterCategoryId = normalizeInteger(filters.filter_category_id);
    const filterTagId = normalizeInteger(filters.filter_tag_id);
    const dateFrom = normalizeString(filters.date_from);
    const dateTo = normalizeString(filters.date_to);
    const sortBy = normalizeString(filters.sort_by, allowedSortFields) || 'position';
    const sortDirection = normalizeString(filters.sort_direction, allowedSortDirections) || 'asc';
    const page = Math.max(normalizeInteger(filters.page) || 1, 1);
    const offset = (page - 1) * PER_PAGE;

    if (queryText) {
      whereClauses.push('(tasks.title LIKE @query OR COALESCE(tasks.description, \'\') LIKE @query)');
      params.query = `%${queryText}%`;
    }

    if (filterStatus) {
      whereClauses.push('tasks.status = @filterStatus');
      params.filterStatus = filterStatus;
    }

    if (filterPriority) {
      whereClauses.push('tasks.priority = @filterPriority');
      params.filterPriority = filterPriority;
    }

    if (filterCategoryId) {
      whereClauses.push(`
        EXISTS (
          SELECT 1
          FROM task_categories tc
          INNER JOIN categories c ON c.id = tc.category_id
          WHERE tc.task_id = tasks.id
            AND tc.category_id = @filterCategoryId
            AND c.user_id = @userId
        )
      `);
      params.filterCategoryId = filterCategoryId;
    }

    if (filterTagId) {
      whereClauses.push(`
        EXISTS (
          SELECT 1
          FROM task_tags tt
          INNER JOIN tags tg ON tg.id = tt.tag_id
          WHERE tt.task_id = tasks.id
            AND tt.tag_id = @filterTagId
            AND tg.user_id = @userId
        )
      `);
      params.filterTagId = filterTagId;
    }

    if (dateFrom) {
      whereClauses.push('tasks.due_date >= @dateFrom');
      params.dateFrom = dateFrom;
    }

    if (dateTo) {
      whereClauses.push('tasks.due_date <= @dateTo');
      params.dateTo = dateTo;
    }

    const whereSql = whereClauses.join(' AND ');
    const orderBySql = buildOrderBy(sortBy, sortDirection);

    const total = db
      .prepare(`
        SELECT COUNT(*) AS total
        FROM tasks
        WHERE ${whereSql}
      `)
      .get(params).total;

    const tasks = db
      .prepare(`
        SELECT
          tasks.id,
          tasks.user_id,
          tasks.title,
          tasks.description,
          tasks.priority,
          tasks.status,
          tasks.due_date,
          tasks.reminder_at,
          tasks.position,
          tasks.completed_at,
          tasks.created_at,
          tasks.updated_at
        FROM tasks
        WHERE ${whereSql}
        ORDER BY ${orderBySql}
        LIMIT @limit OFFSET @offset
      `)
      .all({
        ...params,
        limit: PER_PAGE,
        offset,
      });

    if (tasks.length === 0) {
      return {
        tasks: [],
        total,
        page,
        perPage: PER_PAGE,
      };
    }

    const taskIds = tasks.map((task) => Number(task.id));
    const { placeholders, params: taskIdParams } = buildTaskIdParams(taskIds);

    const categoryRows = db
      .prepare(`
        SELECT
          tc.task_id,
          c.id,
          c.name,
          c.color,
          c.icon
        FROM task_categories tc
        INNER JOIN categories c ON c.id = tc.category_id
        WHERE tc.task_id IN (${placeholders})
          AND c.user_id = @userId
        ORDER BY c.name ASC, c.id ASC
      `)
      .all({ userId, ...taskIdParams });

    const tagRows = db
      .prepare(`
        SELECT
          tt.task_id,
          tg.id,
          tg.name,
          tg.color
        FROM task_tags tt
        INNER JOIN tags tg ON tg.id = tt.tag_id
        WHERE tt.task_id IN (${placeholders})
          AND tg.user_id = @userId
        ORDER BY tg.name ASC, tg.id ASC
      `)
      .all({ userId, ...taskIdParams });

    const categoriesByTask = new Map();
    const tagsByTask = new Map();

    for (const row of categoryRows) {
      const collection = categoriesByTask.get(row.task_id) || [];
      collection.push({
        id: row.id,
        name: row.name,
        color: row.color,
        icon: row.icon,
      });
      categoriesByTask.set(row.task_id, collection);
    }

    for (const row of tagRows) {
      const collection = tagsByTask.get(row.task_id) || [];
      collection.push({
        id: row.id,
        name: row.name,
        color: row.color,
      });
      tagsByTask.set(row.task_id, collection);
    }

    return {
      tasks: tasks.map((task) => ({
        ...task,
        categories: categoriesByTask.get(task.id) || [],
        tags: tagsByTask.get(task.id) || [],
      })),
      total,
      page,
      perPage: PER_PAGE,
    };
  }
}
