import db from '../config/database.js';
import { buildUpdatePayload, ensureUserId, normalizeIntegerIds } from './modelHelpers.js';

const taskColumns = `
  t.id,
  t.user_id,
  t.title,
  t.description,
  t.priority,
  t.status,
  t.completed_at,
  t.due_date,
  t.reminder_at,
  t.position,
  t.reminder_job_id,
  t.deleted_at,
  t.created_at,
  t.updated_at,
  (
    SELECT COUNT(*)
    FROM subtasks st
    WHERE st.task_id = t.id
  ) AS subtask_count,
  (
    SELECT COUNT(*)
    FROM subtasks st
    WHERE st.task_id = t.id
      AND st.is_completed = 1
  ) AS completed_subtask_count,
  (
    SELECT c.name
    FROM task_categories tc
    INNER JOIN categories c ON c.id = tc.category_id
    WHERE tc.task_id = t.id
      AND c.user_id = t.user_id
    ORDER BY c.name ASC, c.id ASC
    LIMIT 1
  ) AS primary_category_name,
  (
    SELECT c.color
    FROM task_categories tc
    INNER JOIN categories c ON c.id = tc.category_id
    WHERE tc.task_id = t.id
      AND c.user_id = t.user_id
    ORDER BY c.name ASC, c.id ASC
    LIMIT 1
  ) AS primary_category_color
`;

const listTaskColumns = `
  t.id,
  t.user_id,
  t.title,
  t.description,
  t.priority,
  t.status,
  t.completed_at,
  t.due_date,
  t.reminder_at,
  t.position,
  t.reminder_job_id,
  t.deleted_at,
  t.created_at,
  t.updated_at,
  COALESCE(subtask_summary.subtask_count, 0) AS subtask_count,
  COALESCE(subtask_summary.completed_subtask_count, 0) AS completed_subtask_count,
  category_summary.primary_category_name,
  category_summary.primary_category_color,
  COALESCE(category_summary.category_names, '') AS category_names,
  COALESCE(tag_summary.tag_names, '') AS tag_names
`;

const findByIdStatement = db.prepare(`
  SELECT ${taskColumns}
  FROM tasks t
  WHERE t.id = @id
    AND t.user_id = @user_id
  LIMIT 1
`);

const createTaskStatement = db.prepare(`
  INSERT INTO tasks (
    user_id,
    title,
    description,
    priority,
    status,
    completed_at,
    due_date,
    reminder_at,
    position,
    reminder_job_id
  ) VALUES (
    @user_id,
    @title,
    @description,
    @priority,
    @status,
    @completed_at,
    @due_date,
    @reminder_at,
    @position,
    @reminder_job_id
  )
`);

const nextPositionStatement = db.prepare(`
  SELECT COALESCE(MAX(position), -1) + 1 AS next_position
  FROM tasks
  WHERE user_id = @user_id
`);

const maxPositionStatement = db.prepare(`
  SELECT COALESCE(MAX(position), -1) AS max_position
  FROM tasks
  WHERE user_id = @user_id
`);

const listTaskRelationsStatement = {
  subtasks: db.prepare(`
    SELECT
      st.id,
      st.task_id,
      st.title,
      st.is_completed,
      st.position,
      st.created_at,
      st.updated_at
    FROM subtasks st
    INNER JOIN tasks t ON t.id = st.task_id
    WHERE st.task_id = @task_id
      AND t.user_id = @user_id
    ORDER BY st.position ASC, st.id ASC
  `),
  categories: db.prepare(`
    SELECT
      c.id,
      c.user_id,
      c.name,
      c.color,
      c.icon,
      c.created_at,
      c.updated_at
    FROM categories c
    INNER JOIN task_categories tc ON tc.category_id = c.id
    INNER JOIN tasks t ON t.id = tc.task_id
    WHERE tc.task_id = @task_id
      AND t.user_id = @user_id
    ORDER BY c.name ASC, c.id ASC
  `),
  tags: db.prepare(`
    SELECT
      tg.id,
      tg.user_id,
      tg.name,
      tg.color,
      tg.created_at,
      tg.updated_at
    FROM tags tg
    INNER JOIN task_tags tt ON tt.tag_id = tg.id
    INNER JOIN tasks t ON t.id = tt.task_id
    WHERE tt.task_id = @task_id
      AND t.user_id = @user_id
    ORDER BY tg.name ASC, tg.id ASC
  `),
};

const reorderTaskStatement = db.prepare(`
  UPDATE tasks
  SET position = @position, updated_at = CURRENT_TIMESTAMP
  WHERE id = @id
    AND user_id = @user_id
`);

const updateTaskStatusStatement = db.prepare(`
  UPDATE tasks
  SET status = @status, updated_at = CURRENT_TIMESTAMP
  WHERE id = @id
    AND user_id = @user_id
`);

const softDeleteAllByUserIdStatement = db.prepare(`
  UPDATE tasks
  SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
  WHERE user_id = @user_id
    AND deleted_at IS NULL
`);

const sortMap = {
  position: 't.position ASC, t.id ASC',
  created: 't.created_at DESC, t.id DESC',
  created_at: 't.created_at DESC, t.id DESC',
  updated: 't.updated_at DESC, t.id DESC',
  updated_at: 't.updated_at DESC, t.id DESC',
  due: "CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, t.due_date ASC, t.id ASC",
  due_date: "CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, t.due_date ASC, t.id ASC",
  priority:
    "CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END, t.id ASC",
  alphabetical: 'LOWER(t.title) ASC, t.id ASC',
  title: 'LOWER(t.title) ASC, t.id ASC',
};

const normalizeTaskRow = (task) => {
  if (!task) {
    return null;
  }

  return {
    ...task,
    subtask_count: Number(task.subtask_count ?? 0),
    completed_subtask_count: Number(task.completed_subtask_count ?? 0),
    category_names:
      typeof task.category_names === 'string' && task.category_names.length > 0
        ? task.category_names.split(',').filter(Boolean)
        : [],
    tag_names:
      typeof task.tag_names === 'string' && task.tag_names.length > 0
        ? task.tag_names.split(',').filter(Boolean)
        : [],
  };
};

const buildListQuery = (userId, filters = {}) => {
  const scopedUserId = ensureUserId(userId);
  const where = ['t.user_id = @user_id'];
  const params = { user_id: scopedUserId };

  if (filters.deletedOnly) {
    where.push('t.deleted_at IS NOT NULL');
  } else if (!filters.includeDeleted) {
    where.push('t.deleted_at IS NULL');
  }

  if (filters.status) {
    where.push('t.status = @status');
    params.status = filters.status;
  }

  if (filters.priority) {
    where.push('t.priority = @priority');
    params.priority = filters.priority;
  }

  if (filters.categoryId) {
    where.push(`
      EXISTS (
        SELECT 1
        FROM task_categories tc
        INNER JOIN categories c ON c.id = tc.category_id
        WHERE tc.task_id = t.id
          AND tc.category_id = @category_id
          AND c.user_id = @user_id
      )
    `);
    params.category_id = Number(filters.categoryId);
  }

  if (filters.tagId) {
    where.push(`
      EXISTS (
        SELECT 1
        FROM task_tags tt
        INNER JOIN tags tg ON tg.id = tt.tag_id
        WHERE tt.task_id = t.id
          AND tt.tag_id = @tag_id
          AND tg.user_id = @user_id
      )
    `);
    params.tag_id = Number(filters.tagId);
  }

  if (filters.search) {
    where.push('(t.title LIKE @search OR COALESCE(t.description, \'\') LIKE @search)');
    params.search = `%${filters.search}%`;
  }

  if (filters.overdue) {
    where.push("t.due_date IS NOT NULL AND date(t.due_date) < date('now') AND t.status != 'completed'");
  }

  if (filters.dueToday) {
    where.push("t.due_date IS NOT NULL AND date(t.due_date) = date('now')");
  }

  const orderBy = sortMap[filters.sort] ?? sortMap.position;
  let sql = `
    SELECT ${listTaskColumns}
    FROM tasks t
    LEFT JOIN (
      SELECT
        st.task_id,
        COUNT(*) AS subtask_count,
        SUM(CASE WHEN st.is_completed = 1 THEN 1 ELSE 0 END) AS completed_subtask_count
      FROM subtasks st
      GROUP BY st.task_id
    ) subtask_summary ON subtask_summary.task_id = t.id
    LEFT JOIN (
      SELECT
        tc.task_id,
        GROUP_CONCAT(DISTINCT c.name) AS category_names,
        MIN(c.name) AS primary_category_name,
        (
          SELECT c2.color
          FROM task_categories tc2
          INNER JOIN categories c2 ON c2.id = tc2.category_id
          WHERE tc2.task_id = tc.task_id
            AND c2.user_id = @user_id
          ORDER BY c2.name ASC, c2.id ASC
          LIMIT 1
        ) AS primary_category_color
      FROM task_categories tc
      INNER JOIN categories c ON c.id = tc.category_id
      WHERE c.user_id = @user_id
      GROUP BY tc.task_id
    ) category_summary ON category_summary.task_id = t.id
    LEFT JOIN (
      SELECT
        tt.task_id,
        GROUP_CONCAT(DISTINCT tg.name) AS tag_names
      FROM task_tags tt
      INNER JOIN tags tg ON tg.id = tt.tag_id
      WHERE tg.user_id = @user_id
      GROUP BY tt.task_id
    ) tag_summary ON tag_summary.task_id = t.id
    WHERE ${where.join(' AND ')}
    ORDER BY ${orderBy}
  `;

  if (filters.limit) {
    sql += '\nLIMIT @limit';
    params.limit = Number(filters.limit);
  }

  if (filters.offset) {
    sql += '\nOFFSET @offset';
    params.offset = Number(filters.offset);
  }

  return { sql, params };
};

const findByUserId = (userId, filters = {}) => {
  const { sql, params } = buildListQuery(userId, filters);
  return db.prepare(sql).all(params).map(normalizeTaskRow);
};

const update = (id, userId, data) => {
  const scopedUserId = ensureUserId(userId);
  const { assignments, params } = buildUpdatePayload(data, [
    'title',
    'description',
    'priority',
    'status',
    'completed_at',
    'due_date',
    'reminder_at',
    'position',
    'reminder_job_id',
    'deleted_at',
  ]);

  if (assignments.length === 0) {
    return findByIdStatement.get({ id, user_id: scopedUserId });
  }

  const statement = db.prepare(`
    UPDATE tasks
    SET ${assignments.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
      AND user_id = @user_id
  `);

  statement.run({ id, user_id: scopedUserId, ...params });

  return normalizeTaskRow(findByIdStatement.get({ id, user_id: scopedUserId }));
};

const getWithRelations = (id, userId) => {
  const scopedUserId = ensureUserId(userId);
  const task = normalizeTaskRow(findByIdStatement.get({ id, user_id: scopedUserId }));

  if (!task) {
    return null;
  }

  return {
    ...task,
    subtasks: listTaskRelationsStatement.subtasks.all({ task_id: id, user_id: scopedUserId }),
    categories: listTaskRelationsStatement.categories.all({ task_id: id, user_id: scopedUserId }),
    tags: listTaskRelationsStatement.tags.all({ task_id: id, user_id: scopedUserId }),
  };
};

const reorder = (tasksArray, userId) => {
  const scopedUserId = ensureUserId(userId);
  const tasks = Array.isArray(tasksArray) ? tasksArray : [];

  db.transaction((items) => {
    for (const item of items) {
      if (!Number.isInteger(Number(item?.id)) || !Number.isInteger(Number(item?.position))) {
        continue;
      }

      reorderTaskStatement.run({
        id: Number(item.id),
        position: Number(item.position),
        user_id: scopedUserId,
      });
    }
  })(tasks);

  return findByUserId(scopedUserId);
};

const bulkUpdateStatus = (ids, status, userId) => {
  const scopedUserId = ensureUserId(userId);
  const taskIds = normalizeIntegerIds(ids);

  if (taskIds.length === 0) {
    return 0;
  }

  let totalChanges = 0;

  db.transaction((items) => {
    for (const id of items) {
      totalChanges += updateTaskStatusStatement.run({ id, status, user_id: scopedUserId }).changes;
    }
  })(taskIds);

  return totalChanges;
};

const TaskModel = {
  findById(id, userId) {
    return normalizeTaskRow(findByIdStatement.get({ id, user_id: ensureUserId(userId) }));
  },
  findByUserId,
  create(data) {
    const userId = ensureUserId(data.user_id);
    const position = data.position ?? nextPositionStatement.get({ user_id: userId })?.next_position ?? 0;
    const result = createTaskStatement.run({
      user_id: userId,
      title: data.title,
      description: data.description ?? null,
      priority: data.priority ?? 'medium',
      status: data.status ?? 'pending',
      completed_at: data.completed_at ?? null,
      due_date: data.due_date ?? null,
      reminder_at: data.reminder_at ?? null,
      position,
      reminder_job_id: data.reminder_job_id ?? null,
    });

    return normalizeTaskRow(findByIdStatement.get({ id: Number(result.lastInsertRowid), user_id: userId }));
  },
  update,
  getMaxPosition(userId) {
    return Number(maxPositionStatement.get({ user_id: ensureUserId(userId) })?.max_position ?? -1);
  },
  softDelete(id, userId) {
    return update(id, userId, { deleted_at: new Date().toISOString() });
  },
  restore(id, userId) {
    return update(id, userId, { deleted_at: null });
  },
  findDeleted(userId) {
    return findByUserId(userId, { deletedOnly: true, sort: 'updated_at' });
  },
  reorder,
  findOverdue(userId) {
    return findByUserId(userId, { overdue: true, sort: 'due_date' });
  },
  findDueToday(userId) {
    return findByUserId(userId, { dueToday: true, sort: 'due_date' });
  },
  getWithRelations,
  bulkUpdateStatus,
  softDeleteAllByUserId(userId) {
    return softDeleteAllByUserIdStatement.run({ user_id: ensureUserId(userId) }).changes;
  },
  search(userId, query, filters = {}) {
    return findByUserId(userId, { ...filters, search: query });
  },
};

export default TaskModel;
