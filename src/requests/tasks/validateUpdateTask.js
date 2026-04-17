import { body, param } from 'express-validator';
import handleValidationErrors from '../handleValidationErrors.js';
import {
  validateDueDateIsTodayOrFuture,
  validateOwnedCategoryIds,
  validateOwnedTagIds,
  validateOwnedTaskParam,
  validateReminderBeforeDueDate,
} from './taskValidationHelpers.js';

const validateUpdateTask = [
  param('id')
    .notEmpty()
    .withMessage('Task id is required.')
    .bail()
    .isInt({ min: 1 })
    .withMessage('Task id must be a positive integer.')
    .bail()
    .custom((value, { req }) => validateOwnedTaskParam(value, req)),
  body('title')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Title must be between 1 and 255 characters.'),
  body('description')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description may not exceed 2000 characters.'),
  body('priority')
    .optional({ values: 'falsy' })
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be low, medium, high, or urgent.'),
  body('status')
    .optional({ values: 'falsy' })
    .isIn(['pending', 'in_progress', 'completed', 'cancelled'])
    .withMessage('Status must be pending, in_progress, completed, or cancelled.'),
  body('due_date')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('Due date must be a valid ISO 8601 date.')
    .bail()
    .custom(validateDueDateIsTodayOrFuture),
  body('reminder_at')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('Reminder time must be a valid ISO 8601 date.')
    .bail()
    .custom((value, { req }) => validateReminderBeforeDueDate(value, req.body.due_date)),
  body('category_ids')
    .optional({ values: 'falsy' })
    .isArray()
    .withMessage('Category ids must be an array.')
    .bail()
    .custom((value, { req }) => validateOwnedCategoryIds(value, req)),
  body('category_ids.*')
    .optional({ values: 'falsy' })
    .isInt({ min: 1 })
    .withMessage('Each category id must be a positive integer.'),
  body('tag_ids')
    .optional({ values: 'falsy' })
    .isArray()
    .withMessage('Tag ids must be an array.')
    .bail()
    .custom((value, { req }) => validateOwnedTagIds(value, req)),
  body('tag_ids.*')
    .optional({ values: 'falsy' })
    .isInt({ min: 1 })
    .withMessage('Each tag id must be a positive integer.'),
  handleValidationErrors,
];

export default validateUpdateTask;
