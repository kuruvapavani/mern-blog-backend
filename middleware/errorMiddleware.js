const notFound = (req, res, next) => {
  const err = new Error(`Not found - ${req.originalUrl}`);
  err.status = 'fail';
  err.statusCode = 404;
  next(err);
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';
  res.status(err.statusCode).json({
    status: err.statusCode,
    message: err.message
  });
};
export default {errorHandler,notFound}