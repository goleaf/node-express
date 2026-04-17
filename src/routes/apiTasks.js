import { Router } from 'express';
import CompleteTaskAction from '../actions/tasks/CompleteTaskAction.js';
import DeleteTaskAction from '../actions/tasks/DeleteTaskAction.js';
import RestoreTaskAction from '../actions/tasks/RestoreTaskAction.js';
import SearchTasksAction from '../actions/tasks/SearchTasksAction.js';
import UpdateTaskAction from '../actions/tasks/UpdateTaskAction.js';
import requireAuth from '../middleware/auth.js';
import validateIntegerParam from '../middleware/validateIntegerParam.js';
import TaskModel from '../models/TaskModel.js';
import validateSearchTasks from '../requests/tasks/validateSearchTasks.js';
import validateUpdateTask from '../requests/tasks/validateUpdateTask.js';

const router = Router();
const completeTaskAction = new CompleteTaskAction();
const updateTaskAction = new UpdateTaskAction();
const deleteTaskAction = new DeleteTaskAction();
const restoreTaskAction = new RestoreTaskAction();
const searchTasksAction = new SearchTasksAction();
const toast = (message, type = 'success') => ({ type, message });

const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const getFilterOptions = (filter) => {
  switch (filter) {
    case 'today':
      return { dueToday: true, sort: 'due_date' };
    case 'overdue':
      return { overdue: true, sort: 'due_date' };
    case 'pending':
      return { status: 'pending', sort: 'position' };
    case 'completed':
      return { status: 'completed', sort: 'updated_at' };
    default:
      return { sort: 'position' };
  }
};

router.use(requireAuth);
router.param('id', validateIntegerParam('id'));

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = String(req.query.filter || 'all');
    const tasks = TaskModel.findByUserId(req.session.userId, getFilterOptions(filter));

    return res.json({ tasks });
  }),
);

router.get(
  '/search',
  validateSearchTasks,
  asyncHandler(async (req, res) => {
    const payload = searchTasksAction.execute(req.session.userId, req.query);
    return res.json(payload);
  }),
);

router.patch(
  '/:id/complete',
  validateUpdateTask,
  asyncHandler(async (req, res) => {
    const existingTask = TaskModel.findById(req.params.id, req.session.userId);
    const task =
      existingTask?.status === 'completed'
        ? updateTaskAction.execute(req.params.id, req.session.userId, { status: 'pending' })
        : completeTaskAction.execute(req.params.id, req.session.userId);

    return res.json({
      success: true,
      toast: toast(task?.status === 'completed' ? 'Task completed' : 'Task marked pending'),
      task,
    });
  }),
);

router.delete(
  '/:id',
  validateUpdateTask,
  asyncHandler(async (req, res) => {
    await deleteTaskAction.execute(req.params.id, req.session.userId);
    return res.json({
      success: true,
      toast: toast('Task deleted'),
    });
  }),
);

router.post(
  '/:id/restore',
  validateUpdateTask,
  asyncHandler(async (req, res) => {
    const task = restoreTaskAction.execute(req.params.id, req.session.userId);
    return res.json({
      success: true,
      toast: toast('Task restored'),
      task,
    });
  }),
);

export default router;
