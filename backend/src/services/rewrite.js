const { AppError } = require('../middleware/error');
const { buildProfileDirective } = require('./style');
const { getPlatform, sanitizeOutput } = require('./generate');

const REWRITE_SYSTEM_PROMPT = `你是一位中文写作编辑。你的任务不是把文章改得更“漂亮”，而是把它改得更像它的作者，同时去掉通用 AI 腔。保留原意和原有信息，不要新增事实，不要解释你改了什么。只输出改写后的正文。`;

function cleanOneLine(value, max = 240) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function normalizeProblems(problems) {
  if (!Array.isArray(problems)) return [];
  return problems
    .slice(0, 12)
    .map((problem) => {
      if (typeof problem === 'string') {
        const reason = cleanOneLine(problem);
        return reason
          ? { paragraph: null, sentence: null, reason, suggestion: '按这个方向改写。' }
          : null;
      }
      if (!problem || typeof problem !== 'object') return null;
      const reason = cleanOneLine(problem.reason);
      if (!reason) return null;
      const paragraph = Number(problem.paragraph);
      return {
        paragraph: Number.isInteger(paragraph) && paragraph > 0 ? paragraph : null,
        sentence: cleanOneLine(problem.sentence, 160) || null,
        reason,
        suggestion: cleanOneLine(problem.suggestion, 200) || '按这个方向改写。',
      };
    })
    .filter(Boolean);
}

function formatProblems(problems) {
  return problems
    .map((problem, index) => {
      const location = problem.paragraph ? `第 ${problem.paragraph} 段` : '全文';
      const quote = problem.sentence ? `「${problem.sentence}」` : '';
      return `${index + 1}. ${location}${quote}：${problem.reason}（建议：${problem.suggestion}）`;
    })
    .join('\n');
}

function buildRewritePrompt({ content, problems, profile, platform: platformKey, topic }) {
  const cleanContent = String(content || '').trim();
  if (!cleanContent) {
    throw new AppError(400, 'INVALID_CONTENT', '没有可以改写的正文');
  }
  const normalized = normalizeProblems(problems);
  const platform = platformKey ? getPlatform(platformKey) : null;

  const sections = [
    '【原文】',
    cleanContent,
    '',
  ];

  if (topic && String(topic).trim()) {
    sections.push('【原始主题】');
    sections.push(String(topic).trim());
    sections.push('');
  }

  sections.push('【需要修复的问题】');
  sections.push(
    normalized.length
      ? formatProblems(normalized)
      : '原文没有明显问题，请在不改变原意的前提下，让它更贴近目标笔迹。'
  );
  sections.push('');

  sections.push('【目标笔迹】');
  if (profile) {
    sections.push(buildProfileDirective(profile));
  } else {
    sections.push(
      '没有提供笔迹档案。请去掉套话、均匀句长和空泛概括，让文字更具体、更像一个真实的人在说话。'
    );
  }
  sections.push('');

  if (platform) {
    sections.push('【发布平台】');
    sections.push(`${platform.label}：${platform.instructions}`);
    sections.push('');
  }

  sections.push('【改写要求】');
  sections.push('1. 逐条修复上面的问题，不要遗漏。');
  sections.push('2. 保留原文的意思、事实和关键信息，不要新增原文没有的事实。');
  sections.push('3. 不要提及“问题”“修改”“原文”“上面”等元信息，也不要向读者解释。');
  sections.push('4. 直接输出改写后的正文，不要写“以下是改写结果”。');
  sections.push('5. 不要为了去 AI 味而故意写得粗糙；目标是像这个作者自然写出来的。');

  return {
    system: REWRITE_SYSTEM_PROMPT,
    user: sections.join('\n'),
    temperature: 0.4,
  };
}

async function rewriteContent({ content, problems, profile, platform, topic }) {
  const llm = require('./llm');
  const prompt = buildRewritePrompt({ content, problems, profile, platform, topic });
  const result = await llm.chat({ ...prompt, label: 'rewrite' });
  return {
    content: sanitizeOutput(result.content),
    cached: result.cached,
  };
}

module.exports = {
  buildRewritePrompt,
  normalizeProblems,
  rewriteContent,
};
