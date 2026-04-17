import ValidationError from '../errors/ValidationError.js';

const wantsHtml = (req) => req.accepts(['html', 'json']) === 'html';

const pushFlashMessage = (req, type, message) => {
  if (!req.session) {
    return;
  }

  req.session.flashMessages = [
    ...(Array.isArray(req.session.flashMessages) ? req.session.flashMessages : []),
    { type, message, text: message },
  ];
};

const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof ValidationError) {
    return res.status(422).json({
      errors: error.errors,
    });
  }

  const statusCode = Number.isInteger(error?.statusCode)
    ? error.statusCode
    : Number.isInteger(error?.status)
      ? error.status
      : 500;

  if (statusCode === 401) {
    if (wantsHtml(req)) {
      pushFlashMessage(req, 'error', error?.message || 'Please log in to continue.');
      return res.redirect('/auth/login');
    }

    return res.status(401).json({
      error: error?.message || 'Authentication is required.',
    });
  }

  if (statusCode === 403 && wantsHtml(req)) {
    return res.status(403).render('errors/403', {
      title: 'Access denied',
      message: error?.message || 'You do not have permission to access this screen.',
    });
  }

  if (statusCode === 404 && wantsHtml(req)) {
    return res.status(404).render('errors/404', {
      title: 'Page not found',
      requestedPath: error?.requestedPath || req.originalUrl,
    });
  }

  if (statusCode >= 500) {
    console.error(error?.stack || error);
  }

  if (!wantsHtml(req)) {
    return res.status(statusCode).json({
      error:
        statusCode >= 500
          ? 'We could not complete that request.'
          : error?.message || 'Request failed.',
    });
  }

  res.status(statusCode).render('errors/error', {
    title: statusCode === 500 ? 'Something went wrong' : 'Request failed',
    statusCode,
    message: statusCode >= 500 ? 'We could not complete that request.' : error?.message || 'Request failed.',
  });
};

export default errorHandler;
