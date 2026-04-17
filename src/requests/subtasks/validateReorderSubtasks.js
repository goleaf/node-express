import { body } from 'express-validator';
import db from '../../config/database.js';
import handleValidationErrors from '../handleValidationErrors.js';

const validateReorderSubtasks = [
  body('subtasks')
    .exists({ checkFalsy: true })
    .withMessage('Subtasks are required.')
    .bail()
    .isArray({ min: 1 })
    .withMessage('Subtasks must be a non-empty array.')
    .bail()
    .custom((value, { req }) => {
      const ids = Array.isArray(value)
        ? value
            .map((item) => Number(item?.id))
            .filter((id) => Number.isInteger(id) && id > 0)
        : [];

      if (ids.length === 0) {
        return true;
      }

      const placeholders = ids.map(() => '?').join(', ');
      const scopedCount = db
        .prepare(
          `
            SELECT COUNT(*) AS total
            FROM subtasks st
            INNER JOIN tasks t ON t.id = st.task_id
            WHERE st.id IN (${placeholders})
              AND t.user_id = ?
          `,
        )
        .get(...ids, req.session.userId).total;

      if (scopedCount !== ids.length) {
        throw new Error('All subtasks must belong to the current user.');
      }

      return true;
    }),
  body('subtasks.*.id')
    .isInt({ min: 1 })
    .withMessage('Each subtask id must be a valid integer.'),
  body('subtasks.*.position')
    .isInt({ min: 0 })
    .withMessage('Each subtask position must be a positive integer or zero.'),
  handleValidationErrors,
];

export default validateReorderSubtasks;
