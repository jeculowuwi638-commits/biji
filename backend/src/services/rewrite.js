const { AppError } = require('../middleware/error');
const { buildProfileDirective } = require('./style');
const { getPlatform, sanitizeOutput } = require('./generate');
const { scoreContent } = require('./score');

const REWRITE_SYSTEM_PROMPT = `你是一位中文写作编辑，擅长用作者本人的笔迹重写文章。你的任务是根据问题清单和目标笔迹，把原文整体重写成一篇读起来像作者本人写的文章，而不是做局部修补。除事实、数字和专有表述外，不要整句照抄原文，要用新的措辞和句式表达同样的意思。保留原意和原文的事实，不要新增原文没有的信息。不要解释你改了什么。只输出改写后的正文。`;

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
      : '原文没有明显问题，请仍按目标笔迹整体重写一遍，让它更像作者本人写的；不要改变原意。'
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
  sections.push('1. 请整篇重写，不要只做局部修补：重新组织句子和段落，除必须保留的事实、数字、专有名词外，不要整句照抄原文。');
  sections.push('2. 【需要修复的问题】中的每一条都要在重写中解决，不要遗漏；观点用第一人称直接说出来（如“我觉得”“我认为”“对我来说”），不要用“我的判断是”这类书面总结句。');
  sections.push('3. 篇幅与原文接近（上下浮动 20% 以内）；参考目标笔迹的平均句长和节奏，单句不要超过档案平均句长的 1.5 倍，也不要把所有句子写成一样长；档案正式度高时，少用“吧、呢、啊、挺、其实”这类口语词，把话说完整。');
  sections.push('4. 保留原文的意思、事实和关键信息（数字、时间、场景、判断），不要新增原文没有的事实，也不要重复原文已经说过的内容。');
  sections.push('5. 去掉通用 AI 腔：套话、空泛概括、模板化递进、均匀句长。');
  sections.push('6. 不要提及“问题”“修改”“原文”“上面”等元信息，也不要向读者解释。');
  sections.push('7. 直接输出改写后的正文，不要写“以下是改写结果”。');
  sections.push('8. 不要为了显得不同而堆砌比喻或抒情；像这个作者自然写出来的。');

  return {
    system: REWRITE_SYSTEM_PROMPT,
    user: sections.join('\n'),
    temperature: 0.7,
  };
}

async function rewriteContent({ content, problems, profile, platform, topic }) {
  const llm = require('./llm');
  const prompt = buildRewritePrompt({ content, problems, profile, platform, topic });
  const result = await llm.chat({ ...prompt, label: 'rewrite', cache: false });
  const sanitized = sanitizeOutput(result.content);
  if (!sanitized) {
    throw new AppError(502, 'LLM_ERROR', '模型返回了空内容，请稍后重试');
  }
  return { content: sanitized };
}

// 整篇重写会带来正常的分数波动；只有明显降分才回退原稿。
const REWRITE_SCORE_TOLERANCE = 5;

/**
 * 降分保护：候选稿比原稿低超过容忍值时回退原稿。
 * 返回的 content 与 score 始终对应“最终保留的正文”。
 */
function evaluateRewriteGuard({ originalContent, candidateContent, profile, platform }) {
  const before = scoreContent({ content: originalContent, profile, platform });
  const after = scoreContent({ content: candidateContent, profile, platform });
  const accepted = after.score >= before.score - REWRITE_SCORE_TOLERANCE;

  return {
    accepted,
    content: accepted ? candidateContent : originalContent,
    beforeScore: before.score,
    afterScore: after.score,
    score: accepted ? after : before,
  };
}

module.exports = {
  buildRewritePrompt,
  normalizeProblems,
  rewriteContent,
  evaluateRewriteGuard,
};
