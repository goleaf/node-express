import db from '../../config/database.js';
import SubtaskModel from '../../models/SubtaskModel.js';

export default class DeleteSubtaskAction {
  execute(subtaskId, taskId, userId) {
    db.transaction(() => {
      SubtaskModel.delete(subtaskId, userId);

      const remainingSubtasks = SubtaskModel.findByTaskId(taskId, userId);
      SubtaskModel.reorder(
        remainingSubtasks.map((subtask, index) => ({
          id: subtask.id,
          position: index,
        })),
        userId,
      );
    })();

    return true;
  }
}
