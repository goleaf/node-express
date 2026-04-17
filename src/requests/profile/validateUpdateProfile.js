import { body } from 'express-validator';
import db from '../../config/database.js';
import { allowedMimeTypes } from '../../config/multer.js';
import handleValidationErrors from '../handleValidationErrors.js';

const validateAvatarFile = (req, res, next) => {
  if (!req.file) {
    next();
    return;
  }

  if (req.file.size > 2 * 1024 * 1024) {
    return res.status(422).json({
      errors: {
        avatar: 'Avatar must not exceed 2MB.',
      },
    });
  }

  if (!allowedMimeTypes.has(req.file.mimetype)) {
    return res.status(422).json({
      errors: {
        avatar: 'Avatar must be a JPEG, PNG, or WebP image.',
      },
    });
  }

  next();
};

const validateUpdateProfile = [
  body('name')
    .exists({ checkFalsy: true })
    .withMessage('Name is required.')
    .bail()
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage('Name must be between 2 and 255 characters.'),
  body('email')
    .exists({ checkFalsy: true })
    .withMessage('Email is required.')
    .bail()
    .isEmail()
    .withMessage('Email must be a valid email address.')
    .bail()
    .normalizeEmail()
    .custom((value, { req }) => {
      const existingUser = db
        .prepare(
          `
            SELECT id
            FROM users
            WHERE email = ?
              AND id != ?
            LIMIT 1
          `,
        )
        .get(value, req.session.userId);

      if (existingUser) {
        throw new Error('Email is already in use.');
      }

      return true;
    }),
  validateAvatarFile,
  handleValidationErrors,
];

export default validateUpdateProfile;
