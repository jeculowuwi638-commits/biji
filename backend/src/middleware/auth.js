const jwt = require('jsonwebtoken');
const config = require('../config');

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: '请先登录',
    });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new Error('invalid subject');
    }
    req.userId = userId;
    req.username = payload.username;
    return next();
  } catch {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: '登录状态已失效，请重新登录',
    });
  }
}

module.exports = { auth };
