import db from '../../config/database.js';
import TaskModel from '../../models/TaskModel.js';

export default class ReorderTasksAction {
  execute(userId, tasksArray) {
    return db.transaction(() => {
      return TaskModel.reorder(tasksArray, userId);
    })();
  }
}
