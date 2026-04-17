import TaskModel from '../../models/TaskModel.js';

export default class RestoreTaskAction {
  execute(taskId, userId) {
    TaskModel.restore(taskId, userId);
    return TaskModel.getWithRelations(taskId, userId);
  }
}
