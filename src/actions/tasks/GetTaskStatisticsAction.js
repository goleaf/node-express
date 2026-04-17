import db from '../../config/database.js';

const summaryStatement = db.prepare(`
  SELECT
    COUNT(*) AS total_tasks,
    COALESCE(SUM(CASE
      WHEN completed_at IS NOT NULL
        AND date(completed_at / 1000, 'unixepoch') = date('now')
      THEN 1
      ELSE 0
    END), 0) AS completed_today,
    COALESCE(SUM(CASE
      WHEN status = 'pending'
      THEN 1
      ELSE 0
    END), 0) AS pending_count,
    COALESCE(SUM(CASE
      WHEN due_date IS NOT NULL
        AND datetime(due_date) < datetime('now')
        AND status != 'completed'
      THEN 1
      ELSE 0
    END), 0) AS overdue_count,
    ROUND(
      COALESCE(
        100.0 * SUM(CASE
          WHEN completed_at IS NOT NULL
            AND datetime(completed_at / 1000, 'unixepoch') >= datetime('now', '-30 days')
          THEN 1
          ELSE 0
        END) / NULLIF(COUNT(*), 0),
        0
      ),
      1
    ) AS completion_rate,
    ROUND(
      AVG(CASE
        WHEN completed_at IS NOT NULL
        THEN ((completed_at / 1000.0) - strftime('%s', created_at)) / 3600.0
        ELSE NULL
      END),
      1
    ) AS avg_completion_time_hours
  FROM tasks
  WHERE user_id = ?
    AND deleted_at IS NULL
`);

const priorityStatement = db.prepare(`
  SELECT
    COALESCE(SUM(CASE WHEN priority = 'low' THEN 1 ELSE 0 END), 0) AS low,
    COALESCE(SUM(CASE WHEN priority = 'medium' THEN 1 ELSE 0 END), 0) AS medium,
    COALESCE(SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END), 0) AS high,
    COALESCE(SUM(CASE WHEN priority = 'urgent' THEN 1 ELSE 0 END), 0) AS urgent
  FROM tasks
  WHERE user_id = ?
    AND deleted_at IS NULL
`);

const categoryBreakdownStatement = db.prepare(`
  SELECT
    c.name AS category_name,
    c.color AS color,
    COUNT(DISTINCT t.id) AS count
  FROM categories c
  LEFT JOIN task_categories tc ON tc.category_id = c.id
  LEFT JOIN tasks t
    ON t.id = tc.task_id
    AND t.user_id = c.user_id
    AND t.deleted_at IS NULL
  WHERE c.user_id = ?
  GROUP BY c.id, c.name, c.color
  HAVING COUNT(DISTINCT t.id) > 0
  ORDER BY count DESC, c.name ASC
`);

const dailyCompletionsStatement = db.prepare(`
  WITH RECURSIVE days(day) AS (
    SELECT date('now', '-6 days')
    UNION ALL
    SELECT date(day, '+1 day')
    FROM days
    WHERE day < date('now')
  ),
  completions AS (
    SELECT
      date(completed_at / 1000, 'unixepoch') AS day,
      COUNT(*) AS count
    FROM tasks
    WHERE user_id = ?
      AND deleted_at IS NULL
      AND completed_at IS NOT NULL
      AND date(completed_at / 1000, 'unixepoch') >= date('now', '-6 days')
    GROUP BY date(completed_at / 1000, 'unixepoch')
  )
  SELECT
    days.day AS date,
    COALESCE(completions.count, 0) AS count
  FROM days
  LEFT JOIN completions ON completions.day = days.day
  ORDER BY days.day ASC
`);

const longestStreakStatement = db.prepare(`
  WITH completion_days AS (
    SELECT DISTINCT date(completed_at / 1000, 'unixepoch') AS day
    FROM tasks
    WHERE user_id = ?
      AND deleted_at IS NULL
      AND completed_at IS NOT NULL
  ),
  ordered_days AS (
    SELECT
      day,
      julianday(day) AS day_number,
      row_number() OVER (ORDER BY day) AS row_num
    FROM completion_days
  ),
  grouped_days AS (
    SELECT
      day,
      day_number - row_num AS streak_group
    FROM ordered_days
  ),
  streaks AS (
    SELECT COUNT(*) AS streak_length
    FROM grouped_days
    GROUP BY streak_group
  )
  SELECT COALESCE(MAX(streak_length), 0) AS longest_streak
  FROM streaks
`);

export default class GetTaskStatisticsAction {
  execute(userId) {
    const summary = summaryStatement.get(userId);
    const priorities = priorityStatement.get(userId);
    const tasksByCategory = categoryBreakdownStatement.all(userId);
    const dailyCompletions = dailyCompletionsStatement.all(userId);
    const longestStreak = longestStreakStatement.get(userId)?.longest_streak ?? 0;

    return {
      total_tasks: Number(summary?.total_tasks ?? 0),
      completed_today: Number(summary?.completed_today ?? 0),
      pending_count: Number(summary?.pending_count ?? 0),
      overdue_count: Number(summary?.overdue_count ?? 0),
      completion_rate: Number(summary?.completion_rate ?? 0),
      tasks_by_priority: {
        low: Number(priorities?.low ?? 0),
        medium: Number(priorities?.medium ?? 0),
        high: Number(priorities?.high ?? 0),
        urgent: Number(priorities?.urgent ?? 0),
      },
      tasks_by_category: tasksByCategory.map((entry) => ({
        category_name: entry.category_name,
        color: entry.color,
        count: Number(entry.count ?? 0),
      })),
      daily_completions: dailyCompletions.map((entry) => ({
        date: entry.date,
        count: Number(entry.count ?? 0),
      })),
      longest_streak: Number(longestStreak ?? 0),
      avg_completion_time_hours: Number(summary?.avg_completion_time_hours ?? 0),
    };
  }
}
