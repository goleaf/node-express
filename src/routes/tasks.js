import { Router } from 'express';
import BulkTaskAction from '../actions/tasks/BulkTaskAction.js';
import CompleteTaskAction from '../actions/tasks/CompleteTaskAction.js';
import CreateTaskAction from '../actions/tasks/CreateTaskAction.js';
import DeleteTaskAction from '../actions/tasks/DeleteTaskAction.js';
import ReorderTasksAction from '../actions/tasks/ReorderTasksAction.js';
import RestoreTaskAction from '../actions/tasks/RestoreTaskAction.js';
import UpdateTaskAction from '../actions/tasks/UpdateTaskAction.js';
import requireAuth from '../middleware/auth.js';
import validateIntegerParam from '../middleware/validateIntegerParam.js';
import CategoryModel from '../models/CategoryModel.js';
import TagModel from '../models/TagModel.js';
import TaskModel from '../models/TaskModel.js';
import validateBulkAction from '../requests/tasks/validateBulkAction.js';
import validateCreateTask from '../requests/tasks/validateCreateTask.js';
import validateReorderTasks from '../requests/tasks/validateReorderTasks.js';
import validateUpdateTask from '../requests/tasks/validateUpdateTask.js';

const router = Router();
const createTaskAction = new CreateTaskAction();
const updateTaskAction = new UpdateTaskAction();
const deleteTaskAction = new DeleteTaskAction();
const completeTaskAction = new CompleteTaskAction();
const reorderTasksAction = new ReorderTasksAction();
const bulkTaskAction = new BulkTaskAction();
const restoreTaskAction = new RestoreTaskAction();
const toast = (message, type = 'success') => ({ type, message });

const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const taskFiltersFromQuery = (query) => {
  const filter = String(query.filter || 'all');
  const filters = {
    filter,
    sort: query.sort || 'position',
  };

  if (filter === 'today') {
    filters.dueToday = true;
    filters.sort = 'due_date';
  }

  if (filter === 'overdue') {
    filters.overdue = true;
    filters.sort = 'due_date';
  }

  if (filter === 'pending') {
    filters.status = 'pending';
  }

  if (filter === 'completed') {
    filters.status = 'completed';
    filters.sort = 'updated_at';
  }

  return {
    ...filters,
    status: query.status || filters.status,
    priority: query.priority || undefined,
    search: query.q || undefined,
    categoryId: query.category_id || undefined,
    tagId: query.tag_id || undefined,
    deletedOnly: query.deleted === 'true',
  };
};

router.use(requireAuth);
router.param('id', validateIntegerParam('id'));

router.get(
  '/new',
  asyncHandler(async (req, res) => {
    return res.render('tasks/form', {
      title: 'New task',
      formMode: 'create',
      task: null,
      categories: CategoryModel.findByUserId(req.session.userId),
      tags: TagModel.findByUserId(req.session.userId),
    });
  }),
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filters = taskFiltersFromQuery(req.query);

    return res.render('tasks/index', {
      title: 'Tasks',
      activeFilter: filters.filter || 'all',
    });
  }),
);

router.post(
  '/',
  validateCreateTask,
  asyncHandler(async (req, res) => {
    const task = createTaskAction.execute(req.session.userId, req.body);
    return res.status(201).json({
      success: true,
      toast: toast('Task created'),
      task,
    });
  }),
);

router.post(
  '/reorder',
  validateReorderTasks,
  asyncHandler(async (req, res) => {
    const tasks = reorderTasksAction.execute(req.session.userId, req.body.tasks);
    return res.json({
      success: true,
      toast: toast('Task order updated'),
      tasks,
    });
  }),
);

router.post(
  '/bulk',
  validateBulkAction,
  asyncHandler(async (req, res) => {
    const result = bulkTaskAction.execute(req.session.userId, req.body.task_ids, req.body.action);
    return res.json({
      ...result,
      success: true,
      toast: toast('Tasks updated'),
    });
  }),
);

router.get(
  '/:id/edit',
  asyncHandler(async (req, res) => {
    const task = TaskModel.getWithRelations(req.params.id, req.session.userId);

    if (!task) {
      const error = new Error('Task not found.');
      error.statusCode = 404;
      throw error;
    }

    return res.render('tasks/form', {
      title: 'Edit task',
      formMode: 'edit',
      task,
      categories: CategoryModel.findByUserId(req.session.userId),
      tags: TagModel.findByUserId(req.session.userId),
    });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const task = TaskModel.getWithRelations(req.params.id, req.session.userId);

    if (!task) {
      const error = new Error('Task not found.');
      error.statusCode = 404;
      throw error;
    }

    return res.render('tasks/show', {
      title: task.title,
      task,
    });
  }),
);

router.patch(
  '/:id',
  validateUpdateTask,
  asyncHandler(async (req, res) => {
    const task = updateTaskAction.execute(req.params.id, req.session.userId, req.body);
    return res.json({
      success: true,
      toast: toast('Task updated'),
      task,
    });
  }),
);

router.put(
  '/:id',
  validateUpdateTask,
  asyncHandler(async (req, res) => {
    const task = updateTaskAction.execute(req.params.id, req.session.userId, req.body);
    return res.json({
      success: true,
      toast: toast('Task updated'),
      task,
    });
  }),
);

router.delete(
  '/:id',
  validateUpdateTask,
  asyncHandler(async (req, res) => {
    deleteTaskAction.execute(req.params.id, req.session.userId);
    return res.json({
      success: true,
      toast: toast('Task deleted'),
    });
  }),
);

router.post(
  '/:id/complete',
  validateUpdateTask,
  asyncHandler(async (req, res) => {
    const task = completeTaskAction.execute(req.params.id, req.session.userId);
    return res.json({
      success: true,
      toast: toast('Task completed'),
      task,
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
