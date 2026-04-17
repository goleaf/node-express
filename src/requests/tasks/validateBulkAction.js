import { body } from 'express-validator';
import handleValidationErrors from '../handleValidationErrors.js';
import { validateOwnedTaskIds } from './taskValidationHelpers.js';

const validateBulkAction = [
  body('task_ids')
    .isArray({ min: 1 })
    .withMessage('Task ids must be a non-empty array.')
    .bail()
    .custom((value, { req }) => validateOwnedTaskIds(value, req)),
  body('task_ids.*')
    .isInt({ min: 1 })
    .withMessage('Each task id must be a positive integer.'),
  body('action')
    .notEmpty()
    .withMessage('Action is required.')
    .bail()
    .isIn(['complete', 'delete', 'restore'])
    .withMessage('Action must be complete, delete, or restore.'),
  handleValidationErrors,
];

export default validateBulkAction;
