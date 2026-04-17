import { body } from 'express-validator';
import handleValidationErrors from '../handleValidationErrors.js';

const validateLogin = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required.')
    .bail()
    .isEmail()
    .withMessage('Email must be a valid email address.')
    .bail()
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required.')
    .bail()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long.'),
  handleValidationErrors,
];

export default validateLogin;
