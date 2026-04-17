import { body } from 'express-validator';
import db from '../../config/database.js';
import handleValidationErrors from '../handleValidationErrors.js';

const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{6})$/;

const validateCreateCategory = [
  body('name')
    .exists({ checkFalsy: true })
    .withMessage('Name is required.')
    .bail()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters.')
    .bail()
    .custom((value, { req }) => {
      const existingCategory = db
        .prepare(
          `
            SELECT id
            FROM categories
            WHERE user_id = ?
              AND lower(name) = lower(?)
            LIMIT 1
          `,
        )
        .get(req.session.userId, value);

      if (existingCategory) {
        throw new Error('Category name must be unique.');
      }

      return true;
    }),
  body('color')
    .exists({ checkFalsy: true })
    .withMessage('Color is required.')
    .bail()
    .matches(HEX_COLOR_REGEX)
    .withMessage('Color must be a valid 6-digit hex value.'),
  body('icon')
    .exists({ checkFalsy: true })
    .withMessage('Icon is required.')
    .bail()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Icon must be between 1 and 50 characters.'),
  handleValidationErrors,
];

export default validateCreateCategory;
