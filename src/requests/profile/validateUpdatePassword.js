import bcrypt from 'bcryptjs';
import { body } from 'express-validator';
import UserModel from '../../models/UserModel.js';
import handleValidationErrors from '../handleValidationErrors.js';

const validateUpdatePassword = [
  body('current_password')
    .exists({ checkFalsy: true })
    .withMessage('Current password is required.')
    .bail()
    .custom(async (value, { req }) => {
      const user = UserModel.findById(req.session.userId);
      const matches = user ? await bcrypt.compare(value, user.password_hash) : false;

      if (!matches) {
        throw new Error('Current password is incorrect.');
      }

      return true;
    }),
  body('password')
    .exists({ checkFalsy: true })
    .withMessage('Password is required.')
    .bail()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters.'),
  body('password_confirmation')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation must match the password.');
      }

      return true;
    }),
  handleValidationErrors,
];

export default validateUpdatePassword;
