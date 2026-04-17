import cron from 'node-cron';
import { randomUUID } from 'node:crypto';
import db from '../../config/database.js';
import mailTransport from '../../config/mail.js';
import UserModel from '../../models/UserModel.js';
import CreateNotificationAction from '../notifications/CreateNotificationAction.js';
import { scheduledTaskReminders } from './taskReminderRegistry.js';

const updateReminderJobIdStatement = db.prepare(`
  UPDATE tasks
  SET reminder_job_id = ?
  WHERE id = ?
`);

const clearReminderJobIdStatement = db.prepare(`
  UPDATE tasks
  SET reminder_job_id = NULL
  WHERE id = ?
`);

const createCronExpression = (date) => {
  return [
    date.getSeconds(),
    date.getMinutes(),
    date.getHours(),
    date.getDate(),
    date.getMonth() + 1,
    '*',
  ].join(' ');
};

export default class SetTaskReminderAction {
  execute(task) {
    if (!task?.id || !task?.user_id || !task?.reminder_at) {
      return null;
    }

    const reminderDate = new Date(task.reminder_at);

    if (Number.isNaN(reminderDate.getTime()) || reminderDate.getTime() <= Date.now()) {
      return null;
    }

    const existingReminder = scheduledTaskReminders.get(task.id);

    if (existingReminder) {
      existingReminder.job.stop();
      scheduledTaskReminders.delete(task.id);
    }

    const reminderJobId = randomUUID();
    const createNotificationAction = new CreateNotificationAction();
    const cronExpression = createCronExpression(reminderDate);

    const job = cron.schedule(cronExpression, () => {
      const now = new Date();

      if (
        now.getFullYear() !== reminderDate.getFullYear() ||
        now.getMonth() !== reminderDate.getMonth() ||
        now.getDate() !== reminderDate.getDate() ||
        now.getHours() !== reminderDate.getHours() ||
        now.getMinutes() !== reminderDate.getMinutes() ||
        now.getSeconds() !== reminderDate.getSeconds()
      ) {
        return;
      }

      const user = UserModel.findById(task.user_id);
      const message = `Reminder: ${task.title}`;

      createNotificationAction.execute(task.user_id, 'task_reminder', {
        taskId: task.id,
        taskTitle: task.title,
        reminderAt: task.reminder_at,
        message,
      });

      if (user?.email) {
        void mailTransport.sendMail({
          from: process.env.MAIL_FROM_ADDRESS || 'todo@example.com',
          to: user.email,
          subject: message,
          text: `Your task "${task.title}" has reached its reminder time.`,
        });
      }

      job.stop();
      scheduledTaskReminders.delete(task.id);
      clearReminderJobIdStatement.run(task.id);
    });

    scheduledTaskReminders.set(task.id, {
      job,
      reminderJobId,
    });

    updateReminderJobIdStatement.run(reminderJobId, task.id);

    return reminderJobId;
  }
}
