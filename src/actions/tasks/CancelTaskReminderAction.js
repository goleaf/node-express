import db from '../../config/database.js';
import { scheduledTaskReminders } from './taskReminderRegistry.js';

const clearReminderJobIdStatement = db.prepare(`
  UPDATE tasks
  SET reminder_job_id = NULL
  WHERE id = ?
`);

export default class CancelTaskReminderAction {
  execute(taskId) {
    const scheduledReminder = scheduledTaskReminders.get(taskId);

    if (scheduledReminder) {
      scheduledReminder.job.stop();
      scheduledTaskReminders.delete(taskId);
    }

    clearReminderJobIdStatement.run(taskId);

    return true;
  }
}
