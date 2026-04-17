import NotificationModel from '../../models/NotificationModel.js';
import { emitNotificationToUser } from './notificationStreams.js';

export default class CreateNotificationAction {
  execute(userId, type, data = {}) {
    const notification = NotificationModel.create({
      user_id: userId,
      type,
      data,
    });

    emitNotificationToUser(userId, {
      notification,
    });

    return notification;
  }
}
