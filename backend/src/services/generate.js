const { AppError } = require('../middleware/error');
const { buildProfileDirective, clamp, normalizeTexts } = require('./style');

/**
 * PLATFORMS 是项目里唯一的平台知识来源。
 * 新增平台只需要在这里加一条配置，不要在任何路由里写 if (platform === 'xxx')。
 */
const PLATFORMS = {
  wechat: {
    key: 'wechat',
    label: '公众号',
    tagline: '深度长文 · 800–1500 字',
    description: '适合完整叙事、观点展开和人物细节。',
    minChars: 800,
    maxChars: 1500,
    instructions: `写一篇公众号长文。从一个具体的切入点进入，不要泛泛而谈。段落之间要有自然的推进关系，可以用小标题，但不要写成工作汇报。结尾落回具体的人、事或场景，不要喊口号。`,
  },
  xiaohongshu: {
    key: 'xiaohongshu',
    label: '小红书',
    tagline: '轻分享 · 300–500 字',
    description: '短段落、少量 emoji、结尾带话题标签。',
    minChars: 300,
    maxChars: 500,
    instructions: `写一篇小红书笔记。开头一句话要有钩子，直接抓住人。段落要短，适合手机阅读。emoji 适量，每段最多两个，不要满屏。结尾给 3–6 个以 # 开头的话题标签。语气像在和关注你的人分享，不要像广告。`,
  },
  douyin: {
    key: 'douyin',
    label: '抖音脚本',
    tagline: '分镜口播 · 60–90 秒',
    description: '画面提示 + 可直接念出来的口播文案。',
    minChars: 350,
    maxChars: 600,
    instructions: `写一份抖音口播脚本。每一段以【镜头 1】这样的标记开头，后面先给一行用括号包住的画面提示，再给口播文案。口播要用短句，有节奏，适合直接念出来。总时长约 60–90 秒。结尾有一个明确的行动号召，但不要生硬。`,
  },
};

const PLATFORM_ORDER = ['wechat', 'xiaohongshu', 'douyin'];

const GENERATE_SYSTEM_PROMPT = `你是一位中文写作者，擅长模仿一个具体的人说话和写作的方式。你从不使用空泛的套话，不堆砌排比，不写“综上所述”式的结尾。你写出的文字应当像一个真实的人在具体情境里表达，而不是一份被润色过的范文。一次生成要同时给出标题和正文：标题要具体、有吸引力，符合发布平台的语气，不超过 30 个字，不要用书名号或引号包起来。严格按“【标题】……【正文】……”的格式输出，不要任何解释，不要使用 Markdown 代码块。`;

function getPlatform(key) {
  const platform = PLATFORMS[key];
  if (!platform) {
    throw new AppError(400, 'INVALID_PLATFORM', '不支持的发布平台');
  }
  return platform;
}

function listPlatforms() {
  return PLATFORM_ORDER.map((key) => {
    const platform = PLATFORMS[key];
    return {
      key: platform.key,
      label: platform.label,
      tagline: platform.tagline,
      description: platform.description,
      minChars: platform.minChars,
      maxChars: platform.maxChars,
    };
  });
}

function normalizeTuning(input) {
  if (!input || typeof input !== 'object') return null;
  const read = (value) => Math.round(clamp(Number(value), 0, 100) || 0);
  const normalized = {
    formality: read(input.formality ?? 50),
    detail: read(input.detail ?? 50),
    emotion: read(input.emotion ?? 50),
    assertiveness: read(input.assertiveness ?? 50),
  };
  return normalized;
}

function formatTuning(tuning) {
  return [
    `- 正式 ↔ 口语：${tuning.formality}/100（0=极正式，100=极口语）`,
    `- 简洁 ↔ 详尽：${tuning.detail}/100（0=极简洁，100=极详尽）`,
    `- 理性 ↔ 感性：${tuning.emotion}/100（0=极理性，100=极感性）`,
    `- 观点强度：${tuning.assertiveness}/100（0=只陈述，100=观点非常鲜明）`,
  ].join('\n');
}

function buildGeneratePrompt({ topic, platform: platformKey, profile, tuningEnabled, tuning }) {
  const platform = getPlatform(platformKey);
  const cleanTopic = String(topic || '').trim();
  if (!cleanTopic) {
    throw new AppError(400, 'INVALID_TOPIC', '请先写下这次想写什么');
  }

  const sections = [
    '【写作任务】',
    '主题 / 素材：',
    cleanTopic,
    '',
    '【发布平台】',
    `平台：${platform.label}`,
    `篇幅：约 ${platform.minChars}–${platform.maxChars} 字`,
    '平台要求：',
    platform.instructions,
    '',
  ];

  if (profile) {
    const texts = normalizeTexts(profile.texts);

    sections.push('【作者原文】');
    if (texts.length) {
      sections.push(
        `下面是作者本人写的 ${texts.length} 篇文章。它们是判断“像不像作者”的第一依据：请先通读，体会用词、句长、断句、段落推进、开头和收尾的方式，然后用同样的笔迹写一个全新的主题。`
      );
      sections.push(
        '只模仿写法，不复述内容：不要照抄、改写或拼接原文里的句子、事件、人物和数据；如果几篇文章的风格不完全一致，以多数文章的共性为准。'
      );
      sections.push('');
      sections.push(
        texts
          .map((text, index) => `--- 原文 ${index + 1} ---\n${text}`)
          .join('\n\n')
      );
    } else {
      sections.push(
        '这份档案没有保存原始文章，本次只能参考下面的档案摘要来写。'
      );
    }

    sections.push('');
    sections.push('【笔迹档案摘要】');
    sections.push(
      '以下是从原文中统计、归纳出的辅助特征，用来校准上面的语感。不要机械地逐条满足，也不要在正文里提到这份档案。'
    );
    sections.push(buildProfileDirective(profile));
  } else {
    sections.push('【笔迹档案】');
    sections.push(
      '本次不提供笔迹档案。请写一篇干净、具体、有信息密度的文章，避免一切常见的 AI 写作腔调。'
    );
  }

  if (tuningEnabled && tuning) {
    sections.push('');
    sections.push('【本次微调】');
    sections.push(
      '在遵循上述笔迹的前提下，按以下方向做明显偏移。这些是本次生成临时参数，不要在正文里提及它们：'
    );
    sections.push(formatTuning(tuning));
  }

  sections.push('');
  sections.push('【输出格式】');
  sections.push('第一行写标题：`【标题】` 后面直接跟标题，不超过 30 个字，不加书名号或引号。');
  sections.push('第二行写 `【正文】`，从下一行开始直接写正文。');
  sections.push('标题和正文都要有，不要只输出其中一部分。');
  sections.push('');
  sections.push('【硬性要求】');
  sections.push('1. 标题要像这个平台会用的标题，具体、有信息量，不要写成“关于……的思考”这类空泛标题。');
  sections.push('2. 正文直接开始，不要写“以下是”“好的”之类的开场。');
  sections.push('3. 不要出现“综上所述”“总的来说”“值得注意的是”“在这个快节奏的时代”等套话。');
  sections.push(`4. 全文控制在约 ${platform.minChars}–${platform.maxChars} 字。`);
  sections.push('5. 平台要求优先；如果风格档案与平台要求冲突，以平台要求为准。');
  sections.push('6. 不要虚构具体的人名、机构名或数据；需要细节时，用可信的生活化细节代替。');
  sections.push('7. 这次要写的是【写作任务】里的主题；作者原文只提供写法和语感，不要把原文的事件、人物或观点当成这次的主题。');

  return {
    system: GENERATE_SYSTEM_PROMPT,
    user: sections.join('\n'),
    temperature: 0.7,
  };
}

function sanitizeOutput(raw) {
  let content = String(raw || '').trim();
  content = content.replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```$/, '').trim();

  const lines = content.split('\n');
  if (
    lines.length > 1 &&
    /^(以下是|好的|当然|这是|下面是).{0,40}[：:]$/.test(lines[0].trim()) &&
    lines[0].trim().length <= 40
  ) {
    lines.shift();
    content = lines.join('\n').trim();
  }

  return content;
}

function sanitizeTitle(raw) {
  return String(raw || '')
    .replace(/^#+\s*/, '')
    .replace(/^\s*[《「『“"']+|[》」』”"']+\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

function fallbackTitle(topic) {
  const line = String(topic || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((item) => item.trim())
    .find(Boolean);
  return (line || '未命名文章').slice(0, 60);
}

/**
 * 模型被要求按“【标题】……【正文】……”输出。
 * 这里兼容常见变体；解析失败时保留完整正文，并用主题生成一个兜底标题。
 */
function parseGeneratedOutput(raw, { topic } = {}) {
  let text = String(raw || '').trim();
  text = text.replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```$/, '').trim();

  let title = '';
  let body = text;
  const titleMarker = /^\s*(?:【标题】|标题[:：])\s*/;

  if (titleMarker.test(text)) {
    text = text.replace(titleMarker, '').trim();
    const bodyMarker = /\n\s*(?:【正文】|正文[:：])\s*\n/;
    const markerIndex = text.search(bodyMarker);
    if (markerIndex >= 0) {
      title = text.slice(0, markerIndex).trim();
      body = text.slice(markerIndex).replace(bodyMarker, '').trim();
    } else {
      // 模型只写了标题标记、漏了正文标记：第一行当标题，其余当正文。
      const lines = text.split('\n');
      title = (lines.shift() || '').trim();
      body = lines.join('\n').trim();
    }
  } else {
    // 没有标题标记时，如果模型单独写了正文标记，把标记前的一行当标题。
    const bodyOnlyMarker = /(?:^|\n)\s*(?:【正文】|正文[:：])\s*\n/;
    const markerIndex = text.search(bodyOnlyMarker);
    if (markerIndex >= 0) {
      const before = text.slice(0, markerIndex).trim();
      const candidate = before.split('\n').pop()?.trim() || '';
      // 标记前如果是一大段正文，说明不是标题，保留完整原文。
      if (candidate && candidate.length <= 60) {
        title = candidate;
        body = text.slice(markerIndex).replace(bodyOnlyMarker, '').trim();
      }
    } else {
      // 没有任何标记时保留完整正文，标题用主题兜底。
      body = text.trim();
    }
  }

  const cleanTitle = sanitizeTitle(title) || fallbackTitle(topic);
  let content = sanitizeOutput(body);
  if (!content) {
    // 解析把内容吃空时回退到原始输出，避免返回空文章。
    content = sanitizeOutput(raw);
  }

  return { title: cleanTitle, content };
}

async function generateText(options) {
  const llm = require('./llm');
  const prompt = buildGeneratePrompt(options);
  const result = await llm.chat({ ...prompt, label: 'generate' });
  return parseGeneratedOutput(result.content, { topic: options.topic });
}

module.exports = {
  PLATFORMS,
  getPlatform,
  listPlatforms,
  normalizeTuning,
  buildGeneratePrompt,
  generateText,
  parseGeneratedOutput,
  sanitizeOutput,
};
