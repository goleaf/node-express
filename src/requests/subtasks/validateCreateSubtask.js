import { body } from 'express-validator';
import db from '../../config/database.js';
import handleValidationErrors from '../handleValidationErrors.js';

const validateCreateSubtask = [
  body('task_id')
    .exists({ checkFalsy: true })
    .withMessage('Task is required.')
    .bail()
    .isInt({ min: 1 })
    .withMessage('Task id must be a valid integer.')
    .bail()
    .custom((value, { req }) => {
      const task = db
        .prepare(
          `
            SELECT id
            FROM tasks
            WHERE id = ?
              AND user_id = ?
              AND deleted_at IS NULL
            LIMIT 1
          `,
        )
        .get(Number(value), req.session.userId);

      if (!task) {
        throw new Error('Task must belong to the current user.');
      }

      return true;
    }),
  body('title')
    .exists({ checkFalsy: true })
    .withMessage('Title is required.')
    .bail()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Title must be between 1 and 255 characters.'),
  body('position')
    .optional({ values: 'falsy' })
    .isInt({ min: 0 })
    .withMessage('Position must be a positive integer or zero.'),
  handleValidationErrors,
];

export default validateCreateSubtask;
