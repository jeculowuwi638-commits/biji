class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// 只挂载在 /api 下，所有未匹配的 API 都返回 JSON，避免落到前端 SPA fallback。
function notFoundHandler(req, res) {
  return res.status(404).json({
    error: 'NOT_FOUND',
    message: '接口不存在',
  });
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  let status = err.status || err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || '服务器开小差了，请稍后再试';
  let details = err.details;

  // Prisma 常见错误翻译成可操作的信息，避免把 SQL 细节暴露给前端。
  if (err.code === 'P2002') {
    status = 409;
    code = 'CONFLICT';
    message = '这条记录已经存在';
  } else if (err.code === 'P2025') {
    status = 404;
    code = 'NOT_FOUND';
    message = '记录不存在';
  } else if (err.code === 'P1001' || err.code === 'P1000') {
    status = 503;
    code = 'DB_UNAVAILABLE';
    message = '数据库暂时不可用，请稍后重试';
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    status = 401;
    code = 'UNAUTHORIZED';
    message = '登录状态已失效，请重新登录';
  }

  if (status >= 500 && !['NO_API_KEY', 'LLM_ERROR'].includes(code)) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  }

  const body = { error: code, message };
  if (details) body.details = details;
  res.status(status).json(body);
}

module.exports = { AppError, asyncHandler, notFoundHandler, errorHandler };
