import TrackEventAction from '../TrackEventAction.js';
import TaskModel from '../../models/TaskModel.js';
import CancelTaskReminderAction from './CancelTaskReminderAction.js';

const trackEventAction = new TrackEventAction();
const cancelTaskReminderAction = new CancelTaskReminderAction();

export default class DeleteTaskAction {
  execute(taskId, userId) {
    const task = TaskModel.findById(taskId, userId);

    if (!task) {
      return false;
    }

    TaskModel.softDelete(taskId, userId);

    if (task.reminder_job_id) {
      cancelTaskReminderAction.execute(taskId);
    }

    trackEventAction.execute(userId, 'task_deleted', {
      task_id: Number(taskId),
    });

    return true;
  }
}
