import { query } from 'express-validator';
import db from '../../config/database.js';
import handleValidationErrors from '../handleValidationErrors.js';

const allowedStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
const allowedPriorities = ['low', 'medium', 'high', 'urgent'];
const allowedSortFields = ['due_date', 'priority', 'created_at', 'title', 'position'];
const allowedSortDirections = ['asc', 'desc'];

const validateOwnership = (tableName, label) => {
  return (value, { req }) => {
    const record = db
      .prepare(
        `
          SELECT id
          FROM ${tableName}
          WHERE id = ?
            AND user_id = ?
          LIMIT 1
        `,
      )
      .get(Number(value), req.session.userId);

    if (!record) {
      throw new Error(`${label} must belong to the current user.`);
    }

    return true;
  };
};

const validateSearchTasks = [
  query('query')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 255 })
    .withMessage('Query must not exceed 255 characters.')
    .bail()
    .escape(),
  query('filter_status')
    .optional({ values: 'falsy' })
    .isIn(allowedStatuses)
    .withMessage('Status filter is invalid.'),
  query('filter_priority')
    .optional({ values: 'falsy' })
    .isIn(allowedPriorities)
    .withMessage('Priority filter is invalid.'),
  query('filter_category_id')
    .optional({ values: 'falsy' })
    .isInt({ min: 1 })
    .withMessage('Category filter must be a valid integer.')
    .bail()
    .custom(validateOwnership('categories', 'Category')),
  query('filter_tag_id')
    .optional({ values: 'falsy' })
    .isInt({ min: 1 })
    .withMessage('Tag filter must be a valid integer.')
    .bail()
    .custom(validateOwnership('tags', 'Tag')),
  query('date_from')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date.'),
  query('date_to')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date.')
    .bail()
    .custom((value, { req }) => {
      if (!req.query.date_from) {
        return true;
      }

      const startDate = new Date(req.query.date_from);
      const endDate = new Date(value);

      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return true;
      }

      if (endDate < startDate) {
        throw new Error('End date must be after the start date.');
      }

      return true;
    }),
  query('sort_by')
    .optional({ values: 'falsy' })
    .isIn(allowedSortFields)
    .withMessage('Sort field is invalid.'),
  query('sort_direction')
    .optional({ values: 'falsy' })
    .isIn(allowedSortDirections)
    .withMessage('Sort direction is invalid.'),
  handleValidationErrors,
];

export default validateSearchTasks;
