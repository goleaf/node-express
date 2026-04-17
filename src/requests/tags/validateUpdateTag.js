import { body, param } from 'express-validator';
import db from '../../config/database.js';
import handleValidationErrors from '../handleValidationErrors.js';

const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{6})$/;

const validateUpdateTag = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Tag id must be a valid integer.'),
  body('name')
    .exists({ checkFalsy: true })
    .withMessage('Name is required.')
    .bail()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Name must be between 1 and 50 characters.')
    .bail()
    .custom((value, { req }) => {
      const existingTag = db
        .prepare(
          `
            SELECT id
            FROM tags
            WHERE user_id = ?
              AND lower(name) = lower(?)
              AND id != ?
            LIMIT 1
          `,
        )
        .get(req.session.userId, value, Number(req.params.id));

      if (existingTag) {
        throw new Error('Tag name must be unique.');
      }

      return true;
    }),
  body('color')
    .exists({ checkFalsy: true })
    .withMessage('Color is required.')
    .bail()
    .matches(HEX_COLOR_REGEX)
    .withMessage('Color must be a valid 6-digit hex value.'),
  handleValidationErrors,
];

export default validateUpdateTag;
