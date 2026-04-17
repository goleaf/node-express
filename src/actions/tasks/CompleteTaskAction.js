import TrackEventAction from '../TrackEventAction.js';
import SubtaskModel from '../../models/SubtaskModel.js';
import TaskModel from '../../models/TaskModel.js';

const trackEventAction = new TrackEventAction();

export default class CompleteTaskAction {
  execute(taskId, userId) {
    TaskModel.update(taskId, userId, {
      status: 'completed',
      completed_at: Date.now(),
    });

    SubtaskModel.completeByTaskId(taskId, userId);

    trackEventAction.execute(userId, 'task_completed', {
      task_id: Number(taskId),
    });

    return TaskModel.getWithRelations(taskId, userId);
  }
}
