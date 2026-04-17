const createParamError = (name) => {
  const error = new Error(`${name} must be a positive integer.`);
  error.statusCode = 400;
  return error;
};

export const validateIntegerParam = (name = 'id') => (req, res, next, value) => {
  const normalizedValue = Number(value);

  if (!Number.isInteger(normalizedValue) || normalizedValue <= 0) {
    return next(createParamError(name));
  }

  req.params[name] = String(normalizedValue);
  return next();
};

export default validateIntegerParam;
