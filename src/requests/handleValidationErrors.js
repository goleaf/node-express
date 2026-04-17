import { validationResult } from 'express-validator';
import ValidationError from '../errors/ValidationError.js';

const handleValidationErrors = (req, res, next) => {
  const result = validationResult(req);

  if (result.isEmpty()) {
    return next();
  }

  const errors = {};

  for (const issue of result.array()) {
    const field = issue.path ?? issue.param;

    if (!field || errors[field]) {
      continue;
    }

    errors[field] = issue.msg;
  }

  return next(new ValidationError(errors));
};

export default handleValidationErrors;
