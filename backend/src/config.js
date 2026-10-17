const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');

function num(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const config = {
  port: num(process.env.PORT, 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  frontendDist: path.resolve(backendRoot, '../frontend/dist'),
  llm: {
    baseUrl: (process.env.LLM_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/+$/, ''),
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || 'deepseek-chat',
    // 可选：DeepSeek V4 系列可设为 disabled 关闭思考模式；其他服务留空即可。
    thinking: (process.env.LLM_THINKING || '').trim().toLowerCase(),
    cachePath:
      process.env.LLM_CACHE_PATH || path.resolve(backendRoot, 'data/llm_cache.json'),
    timeoutMs: num(process.env.LLM_TIMEOUT_MS, 90000),
    retries: num(process.env.LLM_RETRIES, 1),
  },
};

module.exports = config;
