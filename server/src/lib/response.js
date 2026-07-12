export function success(res, data = null, statusCode = 200) {
  return res.status(statusCode).json({
    code: statusCode,
    message: 'success',
    data,
  });
}

export function error(res, statusCode, message, errorCode = null) {
  return res.status(statusCode).json({
    code: statusCode,
    message,
    error: errorCode || message,
    data: null,
  });
}
