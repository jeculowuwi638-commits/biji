const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');

class LlmUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LlmUnavailableError';
    this.code = 'DEMO_NO_CACHE';
    this.status = 503;
  }
}

class LlmApiError extends Error {
  constructor(message, status = 502, details) {
    super(message);
    this.name = 'LlmApiError';
    this.code = 'LLM_ERROR';
    this.status = status;
    this.details = details;
  }
}

let cache = {};
let cacheLoaded = false;
let writeChain = Promise.resolve();
const stats = {
  hits: 0,
  misses: 0,
  apiCalls: 0,
  lastError: null,
};

function loadCache() {
  if (cacheLoaded) return;
  cacheLoaded = true;
  try {
    if (fs.existsSync(config.llm.cachePath)) {
      const raw = fs.readFileSync(config.llm.cachePath, 'utf8');
      const parsed = raw.trim() ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        cache = parsed;
      }
    }
  } catch (error) {
    console.warn(`[llm] 缓存读取失败：${error.message}`);
    cache = {};
  }
}

function makeCacheKey({ system = '', user = '', temperature = 0.7, model = config.llm.model }) {
  return crypto
    .createHash('md5')
    .update(`${model}|${temperature}|${system}|${user}`)
    .digest('hex');
}

function isConfigured() {
  return Boolean(config.llm.apiKey);
}

function getCacheStatus() {
  loadCache();
  return {
    status: Object.keys(cache).length > 0 ? 'ok' : 'empty',
    entries: Object.keys(cache).length,
    path: config.llm.cachePath,
    ...stats,
  };
}

async function persistCache() {
  const target = config.llm.cachePath;
  const payload = `${JSON.stringify(cache, null, 2)}\n`;
  writeChain = writeChain.then(async () => {
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    const temp = `${target}.${process.pid}.tmp`;
    await fs.promises.writeFile(temp, payload, 'utf8');
    try {
      await fs.promises.rename(temp, target);
    } catch {
      // Windows 上极少数情况下 rename 会因目标文件被占用失败，退化为直接写入。
      await fs.promises.writeFile(target, payload, 'utf8');
      await fs.promises.rm(temp, { force: true });
    }
  });
  return writeChain;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callApi({ system, user, temperature }) {
  const attempts = Math.max(0, config.llm.retries) + 1;
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.llm.timeoutMs);
    try {
      stats.apiCalls += 1;
      const payload = {
        model: config.llm.model,
        temperature,
        stream: false,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      };
      // DeepSeek V4 默认开启思考模式，写作类任务不需要，关闭后可显著降低延迟与费用。
      if (config.llm.thinking === 'disabled') {
        payload.thinking = { type: 'disabled' };
      }

      const response = await fetch(`${config.llm.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.llm.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        const retryable = response.status === 429 || response.status >= 500;
        const error = new Error(
          `LLM HTTP ${response.status}${body ? `: ${body.slice(0, 180)}` : ''}`
        );
        error.retryable = retryable;
        error.httpStatus = response.status;
        throw error;
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) {
        throw new Error('LLM 返回内容为空');
      }
      return content.trim();
    } catch (error) {
      lastError = error;
      stats.lastError = error.message;
      if (error.name === 'AbortError') {
        lastError = new Error('LLM 请求超时');
        stats.lastError = lastError.message;
      }
      if (attempt < attempts && error.retryable !== false) {
        await sleep(1200 * attempt);
        continue;
      }
      break;
    } finally {
      clearTimeout(timer);
    }
  }

  const message =
    lastError?.httpStatus === 401 || lastError?.httpStatus === 403
      ? '模型 API Key 无效或没有权限，请检查 .env 配置'
      : '模型调用失败，请检查网络、Base URL 或稍后重试';
  throw new LlmApiError(message, 502, {
    upstream: lastError?.message?.slice(0, 240),
  });
}

/**
 * 全项目唯一的 LLM 出口。
 *
 * 命中缓存 → 毫秒返回（无需 Key）。
 * 未命中且没有 Key → 抛出 DEMO_NO_CACHE，让调用方给出明确的演示提示。
 */
async function chat({ system = '', user, temperature = 0.7, label = 'llm' }) {
  if (typeof user !== 'string' || !user.trim()) {
    throw new LlmApiError('LLM 请求内容为空', 500);
  }

  loadCache();
  const key = makeCacheKey({ system, user, temperature });

  if (cache[key] && typeof cache[key].response === 'string') {
    stats.hits += 1;
    return {
      content: cache[key].response,
      cached: true,
      key,
      label,
    };
  }

  stats.misses += 1;

  if (!isConfigured()) {
    throw new LlmUnavailableError(
      '当前处于无 Key 演示模式，这次输入没有命中预置缓存。请使用页面里的示例素材，或在 .env 中配置 LLM_API_KEY。'
    );
  }

  const content = await callApi({ system, user, temperature });
  cache[key] = {
    response: content,
    createdAt: new Date().toISOString(),
    model: config.llm.model,
    label,
  };
  await persistCache();

  return {
    content,
    cached: false,
    key,
    label,
  };
}

module.exports = {
  chat,
  makeCacheKey,
  isConfigured,
  getCacheStatus,
  loadCache,
  LlmUnavailableError,
  LlmApiError,
};
