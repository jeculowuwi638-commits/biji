const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { prisma } = require('../db');
const { auth } = require('../middleware/auth');
const { AppError, asyncHandler } = require('../middleware/error');

const router = express.Router();

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    bcrypt.hash(password, 10, (error, hash) => (error ? reject(error) : resolve(hash)));
  });
}

function comparePassword(password, hash) {
  return new Promise((resolve, reject) => {
    bcrypt.compare(password, hash, (error, match) => (error ? reject(error) : resolve(match)));
  });
}

function issueToken(user) {
  return jwt.sign(
    { sub: String(user.id), username: user.username },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    createdAt: user.createdAt,
  };
}

function validateCredentials(username, password) {
  if (!/^[\p{L}\p{N}_-]{3,20}$/u.test(username)) {
    throw new AppError(
      400,
      'INVALID_USERNAME',
      '用户名需要 3–20 个字符，只能包含文字、数字、下划线或短横线'
    );
  }
  if (typeof password !== 'string' || password.length < 6 || password.length > 72) {
    throw new AppError(400, 'INVALID_PASSWORD', '密码需要 6–72 个字符');
  }
}

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const username = String(req.body?.username || '').trim();
    const password = req.body?.password;
    validateCredentials(username, password);

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      throw new AppError(409, 'USERNAME_TAKEN', '这个用户名已经被使用了');
    }

    const passwordHash = await hashPassword(password);
    let user;
    try {
      user = await prisma.user.create({
        data: { username, passwordHash },
        select: { id: true, username: true, createdAt: true },
      });
    } catch (error) {
      if (error.code === 'P2002') {
        throw new AppError(409, 'USERNAME_TAKEN', '这个用户名已经被使用了');
      }
      throw error;
    }

    res.status(201).json({
      token: issueToken(user),
      user: publicUser(user),
    });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const username = String(req.body?.username || '').trim();
    const password = req.body?.password;

    if (!username || typeof password !== 'string' || !password) {
      throw new AppError(400, 'INVALID_CREDENTIALS', '请输入用户名和密码');
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      throw new AppError(401, 'INVALID_CREDENTIALS', '用户名或密码不正确');
    }

    const match = await comparePassword(password, user.passwordHash);
    if (!match) {
      throw new AppError(401, 'INVALID_CREDENTIALS', '用户名或密码不正确');
    }

    res.json({
      token: issueToken(user),
      user: publicUser(user),
    });
  })
);

router.get(
  '/me',
  auth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, username: true, createdAt: true },
    });
    if (!user) {
      throw new AppError(401, 'UNAUTHORIZED', '登录状态已失效，请重新登录');
    }
    res.json({ user: publicUser(user) });
  })
);

module.exports = router;
