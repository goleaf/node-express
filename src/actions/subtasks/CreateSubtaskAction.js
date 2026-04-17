import SubtaskModel from '../../models/SubtaskModel.js';

export default class CreateSubtaskAction {
  execute(taskId, userId, data) {
    const position = SubtaskModel.getMaxPosition(taskId, userId) + 1;

    return SubtaskModel.create({
      user_id: userId,
      task_id: taskId,
      title: data.title,
      position,
    });
  }
}
