const notFound = (req, res, next) => {
  const error = new Error('Page not found.');
  error.statusCode = 404;
  error.requestedPath = req.originalUrl;
  next(error);
};

export default notFound;
