import db from '../config/database.js';
import { buildUpdatePayload } from './modelHelpers.js';

const userColumns = `
  id,
  name,
  email,
  password_hash,
  avatar,
  theme_preference,
  default_priority,
  default_view,
  onboarding_completed,
  created_at,
  updated_at
`;

const findByIdStatement = db.prepare(`
  SELECT ${userColumns}
  FROM users
  WHERE id = @id
  LIMIT 1
`);

const findByEmailStatement = db.prepare(`
  SELECT ${userColumns}
  FROM users
  WHERE email = @email
  LIMIT 1
`);

const createUserStatement = db.prepare(`
  INSERT INTO users (
    name,
    email,
    password_hash,
    avatar,
    theme_preference,
    onboarding_completed
  ) VALUES (
    @name,
    @email,
    @password_hash,
    @avatar,
    @theme_preference,
    @onboarding_completed
  )
`);

const deleteUserStatement = db.prepare(`
  DELETE FROM users
  WHERE id = @id
`);

const getWithStatsStatement = db.prepare(`
  SELECT
    u.id,
    u.name,
    u.email,
    u.avatar,
    u.theme_preference,
    u.default_priority,
    u.default_view,
    u.onboarding_completed,
    u.created_at,
    u.updated_at,
    COUNT(t.id) AS task_count,
    SUM(CASE WHEN t.deleted_at IS NULL AND t.status = 'completed' THEN 1 ELSE 0 END) AS completed_task_count,
    SUM(CASE WHEN t.deleted_at IS NOT NULL THEN 1 ELSE 0 END) AS deleted_task_count,
    SUM(
      CASE
        WHEN t.deleted_at IS NULL
          AND t.due_date IS NOT NULL
          AND date(t.due_date) < date('now')
          AND t.status != 'completed'
        THEN 1
        ELSE 0
      END
    ) AS overdue_task_count
  FROM users u
  LEFT JOIN tasks t ON t.user_id = u.id
  WHERE u.id = @id
  GROUP BY u.id
`);

const create = (data) => {
  const result = createUserStatement.run({
    name: data.name,
    email: data.email,
    password_hash: data.password_hash,
    avatar: data.avatar ?? null,
    theme_preference: data.theme_preference ?? 'system',
    default_priority: data.default_priority ?? 'medium',
    default_view: data.default_view ?? 'list',
    onboarding_completed: data.onboarding_completed ?? 0,
  });

  return findByIdStatement.get({ id: Number(result.lastInsertRowid) });
};

const update = (id, data) => {
  const { assignments, params } = buildUpdatePayload(data, [
    'name',
    'email',
    'password_hash',
    'avatar',
    'theme_preference',
    'default_priority',
    'default_view',
    'onboarding_completed',
  ]);

  if (assignments.length === 0) {
    return findByIdStatement.get({ id });
  }

  const statement = db.prepare(`
    UPDATE users
    SET ${assignments.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `);

  statement.run({ id, ...params });

  return findByIdStatement.get({ id });
};

const updateAvatar = (id, path) => update(id, { avatar: path });
const updateTheme = (id, theme) => update(id, { theme_preference: theme });

const getWithStats = (id) => {
  const user = getWithStatsStatement.get({ id });

  if (!user) {
    return null;
  }

  return {
    ...user,
    task_count: Number(user.task_count ?? 0),
    completed_task_count: Number(user.completed_task_count ?? 0),
    deleted_task_count: Number(user.deleted_task_count ?? 0),
    overdue_task_count: Number(user.overdue_task_count ?? 0),
  };
};

const UserModel = {
  findById(id) {
    return findByIdStatement.get({ id });
  },
  findByEmail(email) {
    return findByEmailStatement.get({ email });
  },
  create,
  update,
  delete(id) {
    return deleteUserStatement.run({ id }).changes > 0;
  },
  updateAvatar,
  updateTheme,
  getWithStats,
};

export default UserModel;
