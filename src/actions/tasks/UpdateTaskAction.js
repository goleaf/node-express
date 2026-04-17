import CategoryModel from '../../models/CategoryModel.js';
import SubtaskModel from '../../models/SubtaskModel.js';
import TagModel from '../../models/TagModel.js';
import TaskModel from '../../models/TaskModel.js';
import CancelTaskReminderAction from './CancelTaskReminderAction.js';
import SetTaskReminderAction from './SetTaskReminderAction.js';

const cancelTaskReminderAction = new CancelTaskReminderAction();
const setTaskReminderAction = new SetTaskReminderAction();

export default class UpdateTaskAction {
  execute(taskId, userId, data) {
    const existingTask = TaskModel.findById(taskId, userId);

    if (!existingTask) {
      return null;
    }

    const updatePayload = {
      title: data.title,
      description: data.description,
      priority: data.priority,
      status: data.status,
      due_date: data.due_date,
      reminder_at: data.reminder_at,
    };

    if (data.status === 'completed') {
      updatePayload.completed_at = Date.now();
    }

    if (data.status && data.status !== 'completed') {
      updatePayload.completed_at = null;
    }

    TaskModel.update(taskId, userId, updatePayload);

    if (Array.isArray(data.category_ids)) {
      CategoryModel.syncTaskCategories(taskId, data.category_ids, userId);
    }

    if (Array.isArray(data.tag_ids)) {
      TagModel.syncTaskTags(taskId, data.tag_ids, userId);
    }

    if (Array.isArray(data.subtasks)) {
      SubtaskModel.deleteByTaskId(taskId, userId);

      data.subtasks
        .map((title) => String(title || '').trim())
        .filter(Boolean)
        .forEach((title, index) => {
          SubtaskModel.create({
            user_id: userId,
            task_id: taskId,
            title,
            position: index,
          });
        });
    }

    const reminderChanged =
      Object.prototype.hasOwnProperty.call(data, 'reminder_at') && data.reminder_at !== existingTask.reminder_at;

    if (reminderChanged) {
      cancelTaskReminderAction.execute(taskId);

      if (data.reminder_at) {
        const nextTask = TaskModel.findById(taskId, userId);

        if (nextTask) {
          setTaskReminderAction.execute(nextTask);
        }
      }
    }

    return TaskModel.getWithRelations(taskId, userId);
  }
}
