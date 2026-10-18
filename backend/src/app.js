const path = require('node:path');
const fs = require('node:fs');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const config = require('./config');
const { prisma } = require('./db');
const llm = require('./services/llm');
const { notFoundHandler, errorHandler } = require('./middleware/error');

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profiles');
const generateRoutes = require('./routes/generate');
const scoreRoutes = require('./routes/score');
const rewriteRoutes = require('./routes/rewrite');
const metaRoutes = require('./routes/meta');
const demoRoutes = require('./routes/demo');

const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '12mb' }));

app.get('/api/health', async (req, res) => {
  let db = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = 'error';
  }
  const cache = llm.getCacheStatus();
  const status = db === 'ok' ? 200 : 503;
  res.status(status).json({
    api: 'ok',
    db,
    cache: cache.status,
    llm: llm.isConfigured() ? 'enabled' : 'disabled',
    cacheEntries: cache.entries,
    cacheHits: cache.hits,
    cacheScope: 'profile-semantic',
    llmCalls: cache.apiCalls,
    model: llm.isConfigured() ? config.llm.model : null,
    time: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/score', scoreRoutes);
app.use('/api/rewrite', rewriteRoutes);
app.use('/api/meta', metaRoutes);
app.use('/api/demo', demoRoutes);

app.use('/api', notFoundHandler);

const indexHtml = path.join(config.frontendDist, 'index.html');
if (fs.existsSync(indexHtml)) {
  app.use(
    express.static(config.frontendDist, {
      index: false,
      maxAge: '1h',
      setHeaders(res, filePath) {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    })
  );
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    return res.sendFile(indexHtml);
  });
} else {
  app.get('/', (req, res) => {
    res.type('text/plain').send(
      '笔迹 API 正在运行。前端开发请访问 Vite 的 5173 端口，或先执行 npm run build。'
    );
  });
}

app.use((err, req, res, next) => {
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'INVALID_JSON',
      message: '请求体不是合法的 JSON',
    });
  }
  return errorHandler(err, req, res, next);
});

let server = null;

if (require.main === module) {
  llm.loadCache();
  const cache = llm.getCacheStatus();

  server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`笔迹 API 已启动：http://localhost:${config.port}`);
    console.log(
      llm.isConfigured()
        ? `LLM：${config.llm.model} · 语义缓存条目 ${cache.entries}（仅档案分析）`
        : 'LLM：未配置 LLM_API_KEY（生成/改写/档案分析不可用）'
    );
    if (config.jwtSecret === 'dev-secret-change-me') {
      console.warn('提示：当前使用默认 JWT_SECRET，正式演示前可以在 .env 中替换。');
    }
  });

  const shutdown = async (signal) => {
    console.log(`收到 ${signal}，正在关闭服务…`);
    if (server) server.close();
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

module.exports = app;
