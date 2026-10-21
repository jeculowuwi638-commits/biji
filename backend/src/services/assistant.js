const { AppError } = require('../middleware/error');

const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 4000;
const MAX_TOTAL_CHARS = 24000;

/**
 * 助手是一个独立的写作问答窗口：
 * 只接收当前对话里的 user / assistant 消息，不读取笔迹档案、文章正文或任何用户数据。
 */
const ASSISTANT_SYSTEM_PROMPT = `你是一位中文写作助手。用户会问你关于措辞、句子、段落、开头、结尾和改稿的问题。

请遵守以下规则：
1. 只根据当前对话里用户提供的信息回答。你没有读过用户的笔迹档案，也没有读取过他的文章；不要假装知道这些内容。
2. 如果用户的问题需要看原文，但没有把原文贴出来，就直接请他贴出相关句子或段落。
3. 回答要具体，能直接落到写作上。需要时给出可替换的句子，不要只讲抽象原则。
4. 不要使用“综上所述”“值得注意的是”这类套话，也不要写成长篇教程。
5. 用中文回答，语气自然、简洁。`;

function normalizeMessages(raw) {
  if (!Array.isArray(raw) || !raw.length) {
    throw new AppError(400, 'INVALID_MESSAGES', '请先写下想问助手的问题');
  }

  if (raw.length > 60) {
    throw new AppError(400, 'INVALID_MESSAGES', '对话太长了，请先清空对话再继续');
  }

  const messages = raw.map((item) => {
    const role = item?.role;
    if (role !== 'user' && role !== 'assistant') {
      throw new AppError(400, 'INVALID_MESSAGES', '对话消息的角色不正确');
    }
    const content = typeof item?.content === 'string' ? item.content.trim() : '';
    if (!content) {
      throw new AppError(400, 'INVALID_MESSAGES', '对话消息不能为空');
    }
    if (content.length > MAX_MESSAGE_CHARS) {
      throw new AppError(
        400,
        'INVALID_MESSAGES',
        `单条消息不能超过 ${MAX_MESSAGE_CHARS} 个字符`
      );
    }
    return { role, content };
  });

  if (messages[messages.length - 1].role !== 'user') {
    throw new AppError(400, 'INVALID_MESSAGES', '最后一条消息必须是提问');
  }

  const totalChars = messages.reduce((sum, item) => sum + item.content.length, 0);
  if (totalChars > MAX_TOTAL_CHARS) {
    throw new AppError(400, 'INVALID_MESSAGES', '对话内容太长了，请先清空对话再继续');
  }

  // 只把最近 20 条发给模型，避免历史无限增长。
  const recent = messages.slice(-MAX_MESSAGES);
  if (recent.length > 1 && recent[0].role === 'assistant') {
    recent.shift();
  }
  return recent;
}

function buildAssistantPrompt(rawMessages) {
  const messages = normalizeMessages(rawMessages);
  return {
    system: ASSISTANT_SYSTEM_PROMPT,
    messages,
    temperature: 0.6,
  };
}

async function answerQuestion(rawMessages) {
  const llm = require('./llm');
  const prompt = buildAssistantPrompt(rawMessages);
  const result = await llm.chatMessages({
    system: prompt.system,
    messages: prompt.messages,
    temperature: prompt.temperature,
    label: 'assistant',
  });
  return { reply: result.content };
}

module.exports = {
  ASSISTANT_SYSTEM_PROMPT,
  MAX_MESSAGES,
  buildAssistantPrompt,
  normalizeMessages,
  answerQuestion,
};
