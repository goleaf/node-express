import { Router } from 'express';
import CreateSubtaskAction from '../actions/subtasks/CreateSubtaskAction.js';
import DeleteSubtaskAction from '../actions/subtasks/DeleteSubtaskAction.js';
import ReorderSubtasksAction from '../actions/subtasks/ReorderSubtasksAction.js';
import ToggleSubtaskAction from '../actions/subtasks/ToggleSubtaskAction.js';
import UpdateSubtaskAction from '../actions/subtasks/UpdateSubtaskAction.js';
import requireAuth from '../middleware/auth.js';
import validateIntegerParam from '../middleware/validateIntegerParam.js';
import SubtaskModel from '../models/SubtaskModel.js';
import validateCreateSubtask from '../requests/subtasks/validateCreateSubtask.js';
import validateReorderSubtasks from '../requests/subtasks/validateReorderSubtasks.js';
import validateUpdateSubtask from '../requests/subtasks/validateUpdateSubtask.js';

const router = Router();
const createSubtaskAction = new CreateSubtaskAction();
const updateSubtaskAction = new UpdateSubtaskAction();
const toggleSubtaskAction = new ToggleSubtaskAction();
const deleteSubtaskAction = new DeleteSubtaskAction();
const reorderSubtasksAction = new ReorderSubtasksAction();
const toast = (message, type = 'success') => ({ type, message });

const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const loadScopedSubtask = (req, res, next) => {
  const subtask = SubtaskModel.findById(Number(req.params.id), req.session.userId);

  if (!subtask) {
    return res.status(404).json({
      message: 'Subtask not found.',
    });
  }

  req.subtask = subtask;
  return next();
};

router.use(requireAuth);
router.param('id', validateIntegerParam('id'));

router.post(
  '/',
  validateCreateSubtask,
  asyncHandler(async (req, res) => {
    const subtask = createSubtaskAction.execute(Number(req.body.task_id), req.session.userId, req.body);
    return res.status(201).json({
      success: true,
      toast: toast('Subtask created'),
      subtask,
    });
  }),
);

router.patch(
  '/reorder',
  validateReorderSubtasks,
  asyncHandler(async (req, res) => {
    reorderSubtasksAction.execute(req.session.userId, req.body.subtasks);
    return res.json({
      success: true,
      toast: toast('Subtasks reordered'),
    });
  }),
);

router.patch(
  '/:id',
  loadScopedSubtask,
  validateUpdateSubtask,
  asyncHandler(async (req, res) => {
    const subtask = updateSubtaskAction.execute(req.subtask.id, req.session.userId, req.body);
    return res.json({
      success: true,
      toast: toast('Subtask updated'),
      subtask,
    });
  }),
);

router.patch(
  '/:id/toggle',
  loadScopedSubtask,
  asyncHandler(async (req, res) => {
    const payload = toggleSubtaskAction.execute(req.subtask.id, req.session.userId);
    return res.json({
      ...payload,
      success: true,
    });
  }),
);

router.delete(
  '/:id',
  loadScopedSubtask,
  asyncHandler(async (req, res) => {
    deleteSubtaskAction.execute(req.subtask.id, req.subtask.task_id, req.session.userId);
    return res.json({
      success: true,
      toast: toast('Subtask deleted'),
    });
  }),
);

export default router;
