import { body } from 'express-validator';
import handleValidationErrors from '../handleValidationErrors.js';

const validateUpdateSubtask = [
  body('title')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Title must be between 1 and 255 characters.'),
  body('is_completed')
    .optional()
    .isBoolean()
    .withMessage('Completed state must be a boolean value.'),
  handleValidationErrors,
];

export default validateUpdateSubtask;
