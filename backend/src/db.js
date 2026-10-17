const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.PRISMA_LOG === '1' ? ['warn', 'error'] : ['error'],
});

module.exports = { prisma };
