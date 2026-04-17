import { body } from 'express-validator';
import db from '../../config/database.js';
import handleValidationErrors from '../handleValidationErrors.js';

const findUserByEmail = db.prepare(`
  SELECT id
  FROM users
  WHERE email = ?
  LIMIT 1
`);

const validateRegister = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required.')
    .bail()
    .isLength({ min: 2, max: 255 })
    .withMessage('Name must be between 2 and 255 characters.'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required.')
    .bail()
    .isEmail()
    .withMessage('Email must be a valid email address.')
    .bail()
    .normalizeEmail()
    .custom((email) => {
      const existingUser = findUserByEmail.get(email);

      if (existingUser) {
        throw new Error('Email is already registered.');
      }

      return true;
    }),
  body('password')
    .notEmpty()
    .withMessage('Password is required.')
    .bail()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long.'),
  body('password_confirmation')
    .notEmpty()
    .withMessage('Password confirmation is required.')
    .bail()
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation must match password.');
      }

      return true;
    }),
  handleValidationErrors,
];

export default validateRegister;
