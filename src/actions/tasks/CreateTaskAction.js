import TrackEventAction from '../TrackEventAction.js';
import CategoryModel from '../../models/CategoryModel.js';
import SubtaskModel from '../../models/SubtaskModel.js';
import TagModel from '../../models/TagModel.js';
import TaskModel from '../../models/TaskModel.js';
import SetTaskReminderAction from './SetTaskReminderAction.js';

const trackEventAction = new TrackEventAction();
const setTaskReminderAction = new SetTaskReminderAction();

export default class CreateTaskAction {
  execute(userId, data) {
    const position = TaskModel.getMaxPosition(userId) + 1;
    const task = TaskModel.create({
      user_id: userId,
      title: data.title,
      description: data.description ?? null,
      priority: data.priority,
      status: data.status,
      completed_at: data.status === 'completed' ? Date.now() : null,
      due_date: data.due_date ?? null,
      reminder_at: data.reminder_at ?? null,
      position,
    });

    if (Array.isArray(data.category_ids)) {
      CategoryModel.syncTaskCategories(task.id, data.category_ids, userId);
    }

    if (Array.isArray(data.tag_ids)) {
      TagModel.syncTaskTags(task.id, data.tag_ids, userId);
    }

    if (Array.isArray(data.subtasks) && data.subtasks.length > 0) {
      data.subtasks
        .map((title) => String(title || '').trim())
        .filter(Boolean)
        .forEach((title, index) => {
          SubtaskModel.create({
            user_id: userId,
            task_id: task.id,
            title,
            position: index,
          });
        });
    }

    if (task.reminder_at) {
      setTaskReminderAction.execute(task);
    }

    trackEventAction.execute(userId, 'task_created', {
      priority: data.priority,
    });

    return TaskModel.getWithRelations(task.id, userId);
  }
}
