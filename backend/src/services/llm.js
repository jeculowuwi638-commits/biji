const config = require('../config');

class NoApiKeyError extends Error {
  constructor(message = '无 API Key：请在 backend/.env 中配置 LLM_API_KEY 后重启服务。') {
    super(message);
    this.name = 'NoApiKeyError';
    this.code = 'NO_API_KEY';
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

const stats = {
  apiCalls: 0,
  lastError: null,
};

function isConfigured() {
  return Boolean(String(config.llm.apiKey || '').trim());
}

function getStats() {
  return { ...stats };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callApi({ messages, temperature = 0.7 }) {
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
        messages,
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
 * 必须配置 LLM_API_KEY，否则直接抛 NO_API_KEY。
 * 这里不保存任何模型响应：生成、档案分析和助手对话每次都会真实调用模型。
 */
async function chat({ system = '', user, temperature = 0.7, label = 'llm' }) {
  if (typeof user !== 'string' || !user.trim()) {
    throw new LlmApiError('LLM 请求内容为空', 500);
  }

  if (!isConfigured()) {
    throw new NoApiKeyError();
  }

  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: user });

  const content = await callApi({ messages, temperature });
  return { content, label };
}

/**
 * 多轮对话入口：messages 是已经排好序的 user / assistant 消息。
 * 助手只携带对话本身，不读取档案、文章或其他项目数据。
 */
async function chatMessages({ system = '', messages, temperature = 0.6, label = 'llm' }) {
  if (!Array.isArray(messages) || !messages.length) {
    throw new LlmApiError('LLM 对话消息为空', 500);
  }

  if (!isConfigured()) {
    throw new NoApiKeyError();
  }

  const apiMessages = system
    ? [{ role: 'system', content: system }, ...messages]
    : messages;

  const content = await callApi({ messages: apiMessages, temperature });
  return { content, label };
}

module.exports = {
  chat,
  chatMessages,
  isConfigured,
  getStats,
  NoApiKeyError,
  LlmApiError,
};
