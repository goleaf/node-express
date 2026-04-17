import db from '../../config/database.js';
import SubtaskModel from '../../models/SubtaskModel.js';

export default class ReorderSubtasksAction {
  execute(userId, subtasksArray) {
    db.transaction(() => {
      SubtaskModel.reorder(subtasksArray, userId);
    })();

    return true;
  }
}
