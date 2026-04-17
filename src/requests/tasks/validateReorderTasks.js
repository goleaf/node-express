import { body } from 'express-validator';
import handleValidationErrors from '../handleValidationErrors.js';

const validateReorderTasks = [
  body('tasks')
    .isArray({ min: 1 })
    .withMessage('Tasks must be a non-empty array.'),
  body('tasks.*.id')
    .isInt({ min: 1 })
    .withMessage('Each task id must be a positive integer.'),
  body('tasks.*.position')
    .isInt({ min: 0 })
    .withMessage('Each task position must be a non-negative integer.'),
  handleValidationErrors,
];

export default validateReorderTasks;
