const { AppError } = require('../middleware/error');

const STOPWORDS = new Set([
  '一个', '一些', '一种', '一样', '一直', '一起', '一点', '一下', '一切',
  '我们', '你们', '他们', '她们', '它们', '自己', '别人', '大家', '什么',
  '这个', '那个', '这些', '那些', '这样', '那样', '这里', '那里', '这种',
  '没有', '不是', '就是', '还是', '也是', '只是', '但是', '可是', '然后',
  '因为', '所以', '如果', '虽然', '不过', '而且', '并且', '或者', '以及',
  '可以', '可能', '应该', '需要', '已经', '正在', '还有', '有点', '有些',
  '时候', '现在', '今天', '昨天', '明天', '最近', '以后', '以前', '之前',
  '觉得', '知道', '看到', '发现', '开始', '以后', '起来', '出来', '下来',
  '真的', '其实', '反正', '非常', '特别', '比较', '很多', '很少', '一次',
  '东西', '事情', '地方', '问题', '方面', '情况', '时候', '感觉', '好像',
  '不会', '不能', '不要', '不用', '没什么', '怎么样', '为什么', '是不是',
  '的话', '来说', '而言', '一样', '这种', '那种', '其中', '同时', '一定',
  '第一', '第二', '第三', '首先', '其次', '最后', '总之', '另外',
  '上下', '左右', '里面', '外面', '前面', '后面', '中间', '之间',
  '一是', '二是', '三是', '一遍', '那么', '我又', '一次', '两个',
  '一点', '一句', '一天', '一下', '一天天', '这时候', '那时候',
]);

const COLLOQUIAL_PARTICLES = ['啊', '嘛', '呢', '吧', '啦', '哦', '呀', '哈', '呗', '哎', '唉', '喂'];
const COLLOQUIAL_PHRASES = [
  '说真的', '你懂', '我觉得', '我感觉', '其实', '反正', '就是', '然后',
  '有点', '特别', '真的', '挺', '蛮', '咋', '啥', '啥子', '嘛', '什么的',
  '说白了', '老实说', '讲真', '不知道', '怎么会', '对不对', '是不是',
];
const FORMAL_WORDS = [
  '因此', '综上', '鉴于', '针对', '予以', '进一步', '相关', '实施', '推进',
  '优化', '落地', '同步', '复盘', '评估', '风险', '方案', '目标', '节点',
  '口径', '机制', '协同', '梳理', '拆解', '量化', '测算', '立项', '排期',
  '迭代', '灰度', '全量', '转化', '留存', '预算', '资源', '策略', '结构',
  '路径', '前提', '边界', '维度', '逻辑', '结论', '依据', '判断', '原则',
];
const EMOTION_WORDS = [
  '难过', '开心', '害怕', '委屈', '高兴', '想哭', '心跳', '温柔', '喜欢',
  '讨厌', '孤独', '焦虑', '轻松', '感动', '舍不得', '心疼', '幸福', '遗憾',
  '愤怒', '舒服', '踏实', '慌', '累', '烦', '爽', '暖', '冷', '空',
  '不安', '自在', '平静', '怀念', '期待', '失落', '满足', '羞愧', '骄傲',
];
const METAPHOR_WORDS = ['就像', '像是', '好像', '仿佛', '如同', '好比', '似的', '宛如', '像'];
const PERSONAL_MARKERS = [
  '我', '自己', '有一次', '那天', '那次', '后来', '记得', '之前', '最近',
  '那天晚上', '小时候', '上周', '昨天', '今天', '当时',
];
const TRANSITION_WORDS = ['然而', '此外', '因此', '同时', '总之', '换言之', '也就是说', '由此可见'];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function normalizeTexts(texts) {
  if (!Array.isArray(texts)) return [];
  return texts
    .map((text) => String(text || '').replace(/\r\n/g, '\n').trim())
    .filter(Boolean);
}

function countOccurrences(text, word) {
  if (!word) return 0;
  let count = 0;
  let from = 0;
  while (from <= text.length) {
    const index = text.indexOf(word, from);
    if (index === -1) break;
    count += 1;
    from = index + word.length;
  }
  return count;
}

function countWords(text, words) {
  let total = 0;
  for (const word of words) total += countOccurrences(text, word);
  return total;
}

function countPattern(text, pattern) {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

function countEmoji(text) {
  return countPattern(text, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu);
}

/**
 * 把文本切成句子，保留段落编号。用于统计层和逐句检测。
 */
function splitSentences(text) {
  const normalized = String(text || '').replace(/\r\n/g, '\n');
  const paragraphs = normalized.split(/\n+/);
  const sentences = [];
  let paragraphIndex = 0;
  let globalIndex = 0;

  for (const rawParagraph of paragraphs) {
    const paragraph = rawParagraph.trim();
    if (!paragraph) continue;

    const matches = paragraph.match(/[^。！？!?…]+[。！？!?…]*/g);
    const parts = matches && matches.length ? matches : [paragraph];

    for (const rawSentence of parts) {
      const sentence = rawSentence.trim();
      if (!sentence) continue;
      sentences.push({
        index: globalIndex,
        paragraphIndex,
        sentenceIndex: sentences.length,
        text: sentence,
        length: Array.from(sentence.replace(/\s/g, '')).length,
      });
      globalIndex += 1;
    }
    paragraphIndex += 1;
  }

  return sentences;
}

function sentenceLengthStats(sentences) {
  const lengths = sentences.map((sentence) => sentence.length).filter((length) => length > 0);
  if (!lengths.length) {
    return { count: 0, avg: 0, std: 0, shortRatio: 0, variation: 0 };
  }
  const avg = lengths.reduce((sum, length) => sum + length, 0) / lengths.length;
  const variance =
    lengths.reduce((sum, length) => sum + (length - avg) ** 2, 0) / lengths.length;
  const std = Math.sqrt(variance);
  const shortCount = lengths.filter((length) => length <= 15).length;
  return {
    count: lengths.length,
    avg: round1(avg),
    std: round1(std),
    shortRatio: Math.round((shortCount / lengths.length) * 100),
    variation: avg ? round1(std / avg) : 0,
  };
}

function describePunctuation(punctuation, sentenceCount) {
  const parts = [];
  if (punctuation.question >= Math.max(1, sentenceCount * 0.12)) {
    parts.push('问号用得不少，常把句子变成自问自答');
  }
  if (punctuation.exclamation >= Math.max(1, sentenceCount * 0.05)) {
    parts.push('情绪上来时会用感叹号');
  }
  if (punctuation.ellipsis > 0) parts.push('偶尔用省略号留白');
  if (punctuation.dash > 0) parts.push('用破折号补充话外音');
  if (punctuation.quote >= 2) parts.push('习惯把对话或原话放进引号');
  if (!parts.length) parts.push('以句号和逗号为主，标点使用克制');
  return `${parts.join('；')}。`;
}

function quickMetrics(text) {
  const normalized = String(text || '').replace(/\r\n/g, '\n');
  const sentences = splitSentences(normalized);
  const lengthStats = sentenceLengthStats(sentences);
  const chineseChars = (normalized.match(/[一-龥]/g) || []).length;
  const charCount = normalized.replace(/\s/g, '').length;
  const safeChinese = Math.max(1, chineseChars);

  const colloquialRaw =
    countWords(normalized, COLLOQUIAL_PARTICLES) * 2 +
    countWords(normalized, COLLOQUIAL_PHRASES) * 1.6;
  const colloquialism = Math.round(clamp((colloquialRaw / safeChinese) * 520, 0, 100));

  const formalRaw = countWords(normalized, FORMAL_WORDS);
  const formality = Math.round(
    clamp(
      20 +
        (formalRaw / safeChinese) * 1200 +
        Math.max(0, lengthStats.avg - 16) * 1.35 -
        colloquialism * 0.35,
      2,
      96
    )
  );

  const rhetoricalSentences = sentences.filter(
    (sentence) => /[？?]/.test(sentence.text) || /(吗|呢|难道|是不是|对吧|不是吗|何必)/.test(sentence.text)
  ).length;
  const rhetoricalQuestionRate = lengthStats.count
    ? Math.round((rhetoricalSentences / lengthStats.count) * 100)
    : 0;

  const metaphorRaw = countWords(normalized, METAPHOR_WORDS);
  const metaphorDensity = lengthStats.count
    ? Math.round(clamp((metaphorRaw / lengthStats.count) * 100, 0, 100))
    : 0;

  const personalSentences = sentences.filter((sentence) =>
    PERSONAL_MARKERS.some((marker) => sentence.text.includes(marker))
  ).length;
  const personalExperienceRatio = lengthStats.count
    ? Math.round((personalSentences / lengthStats.count) * 100)
    : 0;

  const firstPersonSentences = sentences.filter((sentence) => sentence.text.includes('我')).length;
  const firstPersonRatio = lengthStats.count
    ? Math.round((firstPersonSentences / lengthStats.count) * 100)
    : 0;

  const punctuation = {
    comma: countOccurrences(normalized, '，') + countOccurrences(normalized, ','),
    period: countOccurrences(normalized, '。') + countOccurrences(normalized, '.'),
    question: countOccurrences(normalized, '？') + countOccurrences(normalized, '?'),
    exclamation: countOccurrences(normalized, '！') + countOccurrences(normalized, '!'),
    ellipsis: countOccurrences(normalized, '……') + countOccurrences(normalized, '...'),
    dash: countOccurrences(normalized, '——') + countOccurrences(normalized, '—'),
    quote: countOccurrences(normalized, '“') + countOccurrences(normalized, '‘'),
    colon: countOccurrences(normalized, '：') + countOccurrences(normalized, ':'),
    enum: countOccurrences(normalized, '、'),
    emoji: countEmoji(normalized),
  };

  const emotionRaw = countWords(normalized, EMOTION_WORDS);
  const questionRate = lengthStats.count ? punctuation.question / lengthStats.count : 0;
  const exclamationRate = lengthStats.count ? punctuation.exclamation / lengthStats.count : 0;
  const emotion = Math.round(
    clamp(
      18 +
        (emotionRaw / safeChinese) * 1600 +
        questionRate * 14 +
        exclamationRate * 22 +
        personalExperienceRatio * 0.22,
      0,
      100
    )
  );

  const tone = Math.round(clamp(colloquialism * 0.55 + (100 - formality) * 0.45, 0, 100));

  return {
    charCount,
    chineseChars,
    sentenceCount: lengthStats.count,
    avgSentenceLength: lengthStats.avg,
    sentenceLengthStd: lengthStats.std,
    sentenceLengthVariation: lengthStats.variation,
    shortSentenceRatio: lengthStats.shortRatio,
    colloquialism,
    formality,
    tone,
    emotion,
    rhetoricalQuestionRate,
    metaphorDensity,
    personalExperienceRatio,
    firstPersonRatio,
    punctuation,
    punctuationHabit: describePunctuation(punctuation, lengthStats.count),
    _sentences: sentences,
  };
}

let wordSegmenter = null;
try {
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    wordSegmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });
  }
} catch {
  wordSegmenter = null;
}

function extractHighFrequencyWords(text, limit = 10) {
  const counts = new Map();

  if (wordSegmenter) {
    for (const segment of wordSegmenter.segment(text)) {
      if (!segment.isWordLike) continue;
      const word = String(segment.segment).trim();
      if (word.length < 2) continue;
      if (/^\d+$/.test(word)) continue;
      if (STOPWORDS.has(word)) continue;
      if (!/[一-龥a-zA-Z]/.test(word)) continue;
      counts.set(word, (counts.get(word) || 0) + 1);
    }
  } else {
    // 极老版本的 Node 没有 Intl.Segmenter 时的兜底：只提取反复出现的双字组合。
    const chunks = text.match(/[一-龥]{2,}/g) || [];
    for (const chunk of chunks) {
      for (let i = 0; i < chunk.length - 1; i += 1) {
        const word = chunk.slice(i, i + 2);
        if (STOPWORDS.has(word)) continue;
        counts.set(word, (counts.get(word) || 0) + 1);
      }
    }
  }

  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .filter((item) => item.count >= 2)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.word < b.word ? -1 : a.word > b.word ? 1 : 0;
    })
    .slice(0, limit);
}

/**
 * 统计层：本地计算，0 token。返回可直接入库的 stats 对象。
 */
function analyzeStats(texts) {
  const list = normalizeTexts(texts);
  const combined = list.join('\n\n');
  const metrics = quickMetrics(combined);
  const highFrequencyWords = extractHighFrequencyWords(combined);

  return {
    articleCount: list.length,
    charCount: metrics.charCount,
    chineseChars: metrics.chineseChars,
    sentenceCount: metrics.sentenceCount,
    avgSentenceLength: metrics.avgSentenceLength,
    sentenceLengthStd: metrics.sentenceLengthStd,
    sentenceLengthVariation: metrics.sentenceLengthVariation,
    shortSentenceRatio: metrics.shortSentenceRatio,
    colloquialism: metrics.colloquialism,
    formality: metrics.formality,
    tone: metrics.tone,
    emotion: metrics.emotion,
    rhetoricalQuestionRate: metrics.rhetoricalQuestionRate,
    metaphorDensity: metrics.metaphorDensity,
    personalExperienceRatio: metrics.personalExperienceRatio,
    firstPersonRatio: metrics.firstPersonRatio,
    highFrequencyWords,
    punctuation: metrics.punctuation,
    punctuationHabit: metrics.punctuationHabit,
    analyzedAt: new Date().toISOString(),
  };
}

const SEMANTIC_SYSTEM_PROMPT = `你是一位中文文本风格分析专家。你只根据作者原文提取可复用的表达特征，不评价优劣，不编造原文中没有的习惯。你只输出合法 JSON，不要 Markdown 代码块，不要任何解释。`;

function buildSemanticPrompt(texts) {
  const list = normalizeTexts(texts);
  const user = `请分析下面 ${list.length} 篇同一作者的文章，提取其“笔迹档案”的语义层特征。严格输出以下 JSON 结构：
{
  "openingStyle": "开头倾向，一句话，尽量具体",
  "middleStyle": "中段展开方式，一句话",
  "endingStyle": "结尾倾向，一句话",
  "catchphrases": ["原文中反复出现的口头禅或固定说法，最多 5 个，必须是原文出现过的"],
  "metaphorPreference": "比喻/意象的使用习惯，一句话",
  "exampleHabit": "举例习惯，一句话",
  "viewpointStrength": 0,
  "summary": "60 字以内的整体笔迹摘要",
  "signatureMoves": ["3-4 个标志性写作动作，短句"]
}

viewpointStrength 为 0-100 的整数，0 表示只陈述不表态，100 表示观点非常鲜明。

【原文】
${list.map((text, index) => `--- 第 ${index + 1} 篇 ---\n${text}`).join('\n\n')}`;

  return {
    system: SEMANTIC_SYSTEM_PROMPT,
    user,
    temperature: 0.2,
  };
}

function asString(value, fallback, maxLength) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return fallback;
  return text.slice(0, maxLength);
}

function asStringArray(value, fallback, maxItems, maxLength) {
  if (!Array.isArray(value)) return fallback;
  const list = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, maxItems)
    .map((item) => item.slice(0, maxLength));
  return list.length ? list : fallback;
}

function parseJsonObject(text) {
  let raw = String(text || '').trim();
  if (!raw) throw new Error('empty');
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) throw new Error('no object');
  return JSON.parse(raw.slice(first, last + 1));
}

function normalizeSemantic(value) {
  const raw = typeof value === 'string' ? parseJsonObject(value) : value;
  if (!raw || typeof raw !== 'object') throw new Error('invalid semantic');

  const strength = Number(raw.viewpointStrength);
  return {
    openingStyle: asString(raw.openingStyle, '从一个具体的场景或判断直接切入。', 120),
    middleStyle: asString(raw.middleStyle, '靠具体细节和前后对比推进，不做过多铺陈。', 120),
    endingStyle: asString(raw.endingStyle, '落回具体的人或事，轻轻收住。', 120),
    catchphrases: asStringArray(raw.catchphrases, [], 5, 30),
    metaphorPreference: asString(raw.metaphorPreference, '比喻不多，更依赖具体细节。', 120),
    exampleHabit: asString(raw.exampleHabit, '常用自己的经历和身边小事举例。', 120),
    viewpointStrength: Number.isFinite(strength) ? Math.round(clamp(strength, 0, 100)) : 50,
    summary: asString(raw.summary, '表达具体、节奏自然，习惯把观点落在真实场景里。', 100),
    signatureMoves: asStringArray(
      raw.signatureMoves,
      ['用具体场景开场', '把判断藏在细节里', '结尾不做总结'],
      5,
      40
    ),
  };
}

async function extractSemantic(texts) {
  const llm = require('./llm');
  const prompt = buildSemanticPrompt(texts);
  let response;
  try {
    response = await llm.chat({ ...prompt, label: 'profile-semantic' });
  } catch (error) {
    if (error.code === 'NO_API_KEY') throw error;
    throw new AppError(502, 'LLM_ERROR', '语义分析失败，请稍后重试');
  }

  try {
    return {
      semantic: normalizeSemantic(response.content),
    };
  } catch {
    throw new AppError(
      502,
      'LLM_BAD_JSON',
      '模型返回的档案格式不正确，请重新提取一次'
    );
  }
}

function buildProfileDirective(profile) {
  const stats = profile.stats || {};
  const semantic = profile.semantic || {};
  const highWords = Array.isArray(stats.highFrequencyWords)
    ? stats.highFrequencyWords.map((item) => item.word).join('、')
    : '';
  const catchphrases = Array.isArray(semantic.catchphrases)
    ? semantic.catchphrases.join('、')
    : '';
  const signatureMoves = Array.isArray(semantic.signatureMoves)
    ? semantic.signatureMoves.join('；')
    : '';

  return [
    `- 语言：口语化 ${stats.colloquialism ?? 50}%，正式度 ${stats.formality ?? 50}%`,
    `- 句式：平均句长 ${stats.avgSentenceLength ?? 20} 字；短句比例 ${stats.shortSentenceRatio ?? 30}%；句长标准差 ${stats.sentenceLengthStd ?? 8}`,
    `- 表达：反问句频率 ${stats.rhetoricalQuestionRate ?? 10}%；比喻密度 ${stats.metaphorDensity ?? 10}%；个人经历占比 ${stats.personalExperienceRatio ?? 30}%`,
    `- 语气：亲切度 ${stats.tone ?? 50}/100（0=极正式，100=极亲切）`,
    `- 情绪：感性度 ${stats.emotion ?? 50}/100（0=极理性，100=极感性）`,
    `- 开头习惯：${semantic.openingStyle || '直接进入场景'}`,
    `- 中段习惯：${semantic.middleStyle || '用细节推进'}`,
    `- 结尾习惯：${semantic.endingStyle || '轻轻收住'}`,
    `- 口头禅：${catchphrases || '无特别固定的口头禅'}`,
    `- 高频词：${highWords || '无'}`,
    `- 比喻偏好：${semantic.metaphorPreference || '比喻克制'}`,
    `- 举例习惯：${semantic.exampleHabit || '多用亲身经历'}`,
    `- 观点强度：${semantic.viewpointStrength ?? 50}/100`,
    `- 标志性动作：${signatureMoves || '用具体细节支撑表达'}`,
    `- 档案摘要：${semantic.summary || '具体、自然、有个人节奏'}`,
  ].join('\n');
}

module.exports = {
  analyzeStats,
  buildProfileDirective,
  buildSemanticPrompt,
  extractSemantic,
  normalizeSemantic,
  normalizeTexts,
  quickMetrics,
  sentenceLengthStats,
  splitSentences,
  countOccurrences,
  countPattern,
  countWords,
  clamp,
};
