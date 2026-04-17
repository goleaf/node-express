import { body } from 'express-validator';
import handleValidationErrors from '../handleValidationErrors.js';

const validateResetPassword = [
  body('token')
    .notEmpty()
    .withMessage('Token is required.')
    .bail()
    .isString()
    .withMessage('Token must be a string.'),
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

export default validateResetPassword;
