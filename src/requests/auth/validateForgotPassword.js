import { body } from 'express-validator';
import handleValidationErrors from '../handleValidationErrors.js';

const validateForgotPassword = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required.')
    .bail()
    .isEmail()
    .withMessage('Email must be a valid email address.')
    .bail()
    .normalizeEmail(),
  handleValidationErrors,
];

export default validateForgotPassword;
