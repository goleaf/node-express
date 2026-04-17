import SubtaskModel from '../../models/SubtaskModel.js';

export default class ToggleSubtaskAction {
  execute(subtaskId, userId) {
    const subtask = SubtaskModel.toggleComplete(subtaskId, userId);
    const summary = SubtaskModel.getCompletionSummary(subtask.task_id, userId);
    const totalCount = Number(summary?.total_count || 0);
    const completedCount = Number(summary?.completed_count || 0);
    const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return {
      subtask,
      completionPercentage,
      completedCount,
      totalCount,
    };
  }
}
