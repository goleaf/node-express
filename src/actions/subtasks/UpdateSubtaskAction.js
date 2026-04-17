import SubtaskModel from '../../models/SubtaskModel.js';

export default class UpdateSubtaskAction {
  execute(subtaskId, userId, data) {
    return SubtaskModel.update(subtaskId, userId, data);
  }
}
