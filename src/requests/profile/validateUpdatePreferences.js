import { body } from 'express-validator';
import handleValidationErrors from '../handleValidationErrors.js';

const validateUpdatePreferences = [
  body('theme')
    .exists({ checkFalsy: true })
    .withMessage('Theme is required.')
    .bail()
    .isIn(['light', 'dark', 'system'])
    .withMessage('Theme is invalid.'),
  body('default_priority')
    .exists({ checkFalsy: true })
    .withMessage('Default priority is required.')
    .bail()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Default priority is invalid.'),
  body('default_view')
    .exists({ checkFalsy: true })
    .withMessage('Default view is required.')
    .bail()
    .isIn(['list', 'board', 'calendar'])
    .withMessage('Default view is invalid.'),
  handleValidationErrors,
];

export default validateUpdatePreferences;
