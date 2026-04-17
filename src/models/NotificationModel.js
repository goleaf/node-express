import db from '../config/database.js';
import { ensureUserId, parseJson, toJsonString } from './modelHelpers.js';

const notificationColumns = `
  id,
  user_id,
  type,
  data,
  read_at,
  created_at
`;

const findByUserIdStatement = db.prepare(`
  SELECT ${notificationColumns}
  FROM notifications
  WHERE user_id = @user_id
  ORDER BY created_at DESC, id DESC
`);

const countUnreadStatement = db.prepare(`
  SELECT COUNT(*) AS unread_count
  FROM notifications
  WHERE user_id = @user_id
    AND read_at IS NULL
`);

const markAsReadStatement = db.prepare(`
  UPDATE notifications
  SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
  WHERE id = @id
    AND user_id = @user_id
`);

const markAllAsReadStatement = db.prepare(`
  UPDATE notifications
  SET read_at = CURRENT_TIMESTAMP
  WHERE user_id = @user_id
    AND read_at IS NULL
`);

const createNotificationStatement = db.prepare(`
  INSERT INTO notifications (user_id, type, data, read_at)
  VALUES (@user_id, @type, @data, @read_at)
`);

const deleteNotificationStatement = db.prepare(`
  DELETE FROM notifications
  WHERE id = @id
    AND user_id = @user_id
`);

const findByIdStatement = db.prepare(`
  SELECT ${notificationColumns}
  FROM notifications
  WHERE id = @id
    AND user_id = @user_id
  LIMIT 1
`);

const normalizeNotification = (notification) => {
  if (!notification) {
    return null;
  }

  return {
    ...notification,
    data: parseJson(notification.data, {}),
  };
};

const NotificationModel = {
  findByUserId(userId) {
    return findByUserIdStatement.all({ user_id: ensureUserId(userId) }).map(normalizeNotification);
  },
  countUnread(userId) {
    return Number(countUnreadStatement.get({ user_id: ensureUserId(userId) })?.unread_count ?? 0);
  },
  markAsRead(id, userId) {
    const scopedUserId = ensureUserId(userId);
    markAsReadStatement.run({ id, user_id: scopedUserId });
    return normalizeNotification(findByIdStatement.get({ id, user_id: scopedUserId }));
  },
  markAllAsRead(userId) {
    return markAllAsReadStatement.run({ user_id: ensureUserId(userId) }).changes;
  },
  create(data) {
    const userId = ensureUserId(data.user_id);
    const result = createNotificationStatement.run({
      user_id: userId,
      type: data.type,
      data: toJsonString(data.data, '{}'),
      read_at: data.read_at ?? null,
    });

    return normalizeNotification(findByIdStatement.get({ id: Number(result.lastInsertRowid), user_id: userId }));
  },
  delete(id, userId) {
    return deleteNotificationStatement.run({ id, user_id: ensureUserId(userId) }).changes > 0;
  },
};

export default NotificationModel;
