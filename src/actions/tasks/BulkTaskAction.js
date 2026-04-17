import db from '../../config/database.js';
import CompleteTaskAction from './CompleteTaskAction.js';
import DeleteTaskAction from './DeleteTaskAction.js';
import RestoreTaskAction from './RestoreTaskAction.js';

const actionMap = {
  complete: CompleteTaskAction,
  delete: DeleteTaskAction,
  restore: RestoreTaskAction,
};

export default class BulkTaskAction {
  execute(userId, taskIds, action) {
    const ActionClass = actionMap[action];

    if (!ActionClass) {
      throw new Error('Unsupported bulk action.');
    }

    const actionInstance = new ActionClass();

    return db.transaction(() => {
      let succeeded = 0;
      let failed = 0;

      for (const taskId of taskIds) {
        const result = actionInstance.execute(taskId, userId);

        if (result) {
          succeeded += 1;
        } else {
          failed += 1;
        }
      }

      return { succeeded, failed };
    })();
  }
}
