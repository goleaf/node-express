export default class ValidationError extends Error {
  constructor(errors = {}, message = 'Validation failed.') {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 422;
    this.errors = errors;
  }
}
