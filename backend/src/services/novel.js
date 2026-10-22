const { AppError } = require('../middleware/error');
const { buildProfileDirective, clamp } = require('./style');
const { normalizeMessages } = require('./assistant');
const { scoreContent } = require('./score');

const NARRATORS = [
  {
    key: 'first',
    label: '第一人称',
    hint: '以“我”的所见所知讲述，信息天然受限。',
  },
  {
    key: 'third-limited',
    label: '第三人称限知',
    hint: '跟随一个主要人物的视角，只写他能看到、听到、想到的。',
  },
  {
    key: 'third-omniscient',
    label: '第三人称全知',
    hint: '叙述者知道多个人物的处境，可适度进入不同人的内心。',
  },
  {
    key: 'dual',
    label: '双视角交替',
    hint: '在两个主要人物的有限视角之间切换，注意信息边界。',
  },
];

const NARRATOR_KEYS = new Set(NARRATORS.map((item) => item.key));

const CORRECTION_TYPES = [
  { key: 'character', label: '人物与关系' },
  { key: 'place', label: '地点' },
  { key: 'world-rule', label: '世界观规则' },
  { key: 'timeline', label: '时间线' },
  { key: 'fact', label: '不可改事实' },
  { key: 'other', label: '其他' },
];

const CORRECTION_TYPE_KEYS = new Set(CORRECTION_TYPES.map((item) => item.key));

const MAX_BIBLE_CHAPTER_CHARS = 9000;
const MAX_BIBLE_TOTAL_CHARS = 72000;
const MAX_CONTEXT_TOTAL_CHARS = 24000;
const MAX_CONTEXT_CHAPTER_CHARS = 9000;
const MAX_STYLE_EXCERPT_CHARS = 2600;

function asText(value, fallback = '', maxLength = 500) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

function asPlainText(value, fallback = '', maxLength = 500) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return fallback;
  return text.slice(0, maxLength);
}

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function asScore(value, fallback = 60) {
  return Math.round(clamp(asNumber(value, fallback), 0, 100));
}

function asStringList(value, maxItems = 8, maxLength = 100) {
  if (typeof value === 'string') {
    const list = value
      .split(/[、,，；;\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, maxItems)
      .map((item) => item.slice(0, maxLength));
    return list;
  }
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        return asPlainText(item.name || item.label || item.title || item.content, '', maxLength);
      }
      return '';
    })
    .filter(Boolean)
    .slice(0, maxItems)
    .map((item) => item.slice(0, maxLength));
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}

function countChars(text) {
  return Array.from(String(text || '').replace(/\s/g, '')).length;
}

function truncateMiddle(text, maxChars) {
  const raw = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!raw.length || raw.length <= maxChars) return raw;
  if (maxChars <= 20) return raw.slice(0, maxChars);
  const headLength = Math.ceil(maxChars * 0.72);
  const tailLength = Math.max(1, maxChars - headLength - 12);
  return `${raw.slice(0, headLength)}\n……（中间省略）……\n${raw.slice(-tailLength)}`;
}

function chapterLabel(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return `第 ${value} 章`;
  const text = String(value ?? '').trim();
  if (!text) return '未标注章节';
  if (/^\d+$/.test(text)) return `第 ${text} 章`;
  return text.slice(0, 80);
}

function sortChapters(chapters) {
  return [...asArray(chapters)].sort((a, b) => {
    const orderA = asNumber(a.order, 0);
    const orderB = asNumber(b.order, 0);
    return orderA - orderB;
  });
}

/**
 * 故事记忆卡分析需要覆盖全书，但上下文必须可控。
 * 章节很多时保留开篇、最新一段和均匀抽取的中段，而不是把整本书一次性塞给模型。
 */
function selectChaptersForAnalysis(chapters, maxChapters = 36) {
  const sorted = sortChapters(chapters);
  if (sorted.length <= maxChapters) return sorted;

  const firstCount = 2;
  const lastCount = Math.min(24, sorted.length - firstCount);
  const indexes = new Set();
  for (let index = 0; index < firstCount; index += 1) indexes.add(index);
  for (let index = sorted.length - lastCount; index < sorted.length; index += 1) {
    indexes.add(index);
  }

  const middleStart = firstCount;
  const middleEnd = sorted.length - lastCount;
  const remainingSlots = Math.max(0, maxChapters - indexes.size);
  const middleLength = Math.max(0, middleEnd - middleStart);
  if (remainingSlots > 0 && middleLength > 0) {
    for (let slot = 0; slot < remainingSlots; slot += 1) {
      const index =
        middleStart + Math.floor(((slot + 1) * middleLength) / (remainingSlots + 1));
      indexes.add(Math.min(middleEnd - 1, index));
    }
  }

  return [...indexes]
    .sort((a, b) => a - b)
    .map((index) => sorted[index])
    .filter(Boolean);
}

function narratorLabel(key) {
  const item = NARRATORS.find((entry) => entry.key === key);
  return item ? item.label : NARRATORS[1].label;
}

function narratorDirective(key) {
  const item = NARRATORS.find((entry) => entry.key === key) || NARRATORS[1];
  return `${item.label}：${item.hint}`;
}

function parseJsonLoose(text) {
  let raw = String(text || '').trim();
  if (!raw) throw new Error('empty');
  raw = raw.replace(/^﻿/, '').trim();
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  const tryParse = (value) => {
    if (!value) throw new Error('empty');
    return JSON.parse(value);
  };

  const candidates = [raw];
  const firstObject = raw.indexOf('{');
  const lastObject = raw.lastIndexOf('}');
  if (firstObject !== -1 && lastObject > firstObject) {
    candidates.push(raw.slice(firstObject, lastObject + 1));
  }
  const firstArray = raw.indexOf('[');
  const lastArray = raw.lastIndexOf(']');
  if (firstArray !== -1 && lastArray > firstArray) {
    candidates.push(raw.slice(firstArray, lastArray + 1));
  }

  for (const candidate of candidates) {
    try {
      return tryParse(candidate);
    } catch {
      try {
        // 容错：去掉对象/数组末尾多余逗号后再试一次。
        return tryParse(candidate.replace(/,\s*([}\]])/g, '$1'));
      } catch {
        // 继续尝试下一个切片。
      }
    }
  }
  throw new Error('not-json');
}

async function callLlm(options) {
  const llm = require('./llm');
  try {
    return await llm.chat(options);
  } catch (error) {
    if (error.code === 'NO_API_KEY') throw error;
    throw new AppError(502, 'LLM_ERROR', '模型调用失败，请稍后重试');
  }
}

async function callLlmMessages(options) {
  const llm = require('./llm');
  try {
    return await llm.chatMessages(options);
  } catch (error) {
    if (error.code === 'NO_API_KEY') throw error;
    throw new AppError(502, 'LLM_ERROR', '模型调用失败，请稍后重试');
  }
}

/* ------------------------------------------------------------------ */
/* 故事记忆卡                                                          */
/* ------------------------------------------------------------------ */

function normalizeCharacter(value) {
  const raw = value && typeof value === 'object' ? value : {};
  const relationships = asArray(raw.relationships ?? raw.relations)
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (!item || typeof item !== 'object') return '';
      const from = asPlainText(item.from || item.name || item.other, '', 50);
      const type = asPlainText(item.type || item.relation, '', 60);
      const description = asPlainText(item.description || item.note, '', 160);
      return [from, type, description].filter(Boolean).join(' · ');
    })
    .filter(Boolean)
    .slice(0, 10)
    .map((item) => item.slice(0, 200));

  return {
    name: asPlainText(raw.name || raw['姓名'] || raw.character, '未命名角色', 60),
    role: asPlainText(raw.role || raw.identity || raw['身份'], '身份未标注', 100),
    traits: asStringList(raw.traits ?? raw.personality ?? raw['性格'], 8, 80),
    relationships,
    knowledge: asPlainText(
      raw.knowledge || raw.knows || raw['已知信息'] || raw['认知'],
      '暂未记录',
      400
    ),
    status: asPlainText(raw.status || raw['状态'], '未标注', 60),
    arc: asPlainText(raw.arc || raw['人物弧光'], '', 300),
    firstChapter: chapterLabel(raw.firstChapter || raw['首次出现']),
  };
}

function normalizeRelationship(value) {
  const raw = value && typeof value === 'object' ? value : {};
  return {
    from: asPlainText(raw.from || raw.a || raw['人物A'], '未标注', 60),
    to: asPlainText(raw.to || raw.b || raw['人物B'], '未标注', 60),
    type: asPlainText(raw.type || raw.relation || raw['关系'], '关系未标注', 80),
    description: asPlainText(raw.description || raw.note || raw['说明'], '', 300),
    status: asPlainText(raw.status || raw['状态'], '当前有效', 60),
  };
}

function normalizePlace(value) {
  const raw = value && typeof value === 'object' ? value : {};
  return {
    name: asPlainText(raw.name || raw['名称'], '未命名地点', 60),
    description: asPlainText(raw.description || raw['描述'], '', 300),
    rules: asPlainText(raw.rules || raw.note || raw['规则'], '', 300),
    firstChapter: chapterLabel(raw.firstChapter || raw['首次出现']),
  };
}

function normalizeWorldRule(value) {
  const raw = value && typeof value === 'object' ? value : {};
  return {
    name: asPlainText(raw.name || raw['名称'], '未命名规则', 80),
    rule: asPlainText(raw.rule || raw.description || raw['内容'], '', 400),
    evidence: asPlainText(raw.evidence || raw['依据'], '', 200),
  };
}

function normalizeTimelineItem(value) {
  const raw = value && typeof value === 'object' ? value : {};
  return {
    chapter: chapterLabel(raw.chapter || raw['章节']),
    time: asPlainText(raw.time || raw['时间'], '时间未标注', 100),
    event: asPlainText(raw.event || raw.summary || raw['事件'], '', 300),
    impact: asPlainText(raw.impact || raw['影响'], '', 200),
  };
}

function normalizeEvent(value) {
  const raw = value && typeof value === 'object' ? value : {};
  return {
    chapter: chapterLabel(raw.chapter || raw['章节']),
    title: asPlainText(raw.title || raw['标题'], '未命名事件', 100),
    summary: asPlainText(raw.summary || raw.description || raw['摘要'], '', 400),
    impact: asPlainText(raw.impact || raw['影响'], '', 200),
  };
}

function normalizeForeshadowing(value, index) {
  const raw = value && typeof value === 'object' ? value : {};
  const statusText = String(raw.status || raw['状态'] || '').toLowerCase();
  const resolved =
    /resolved|closed|回收|解决|已揭晓|已兑现/.test(statusText) ||
    Boolean(raw.resolvedChapter || raw['回收章节']);
  return {
    id: asPlainText(raw.id || raw['编号'], `foreshadowing-${index + 1}`, 40),
    label: asPlainText(raw.label || raw.title || raw['名称'], '未命名伏笔', 120),
    description: asPlainText(raw.description || raw['描述'], '', 400),
    plantedChapter: chapterLabel(raw.plantedChapter || raw.chapter || raw['埋设章节']),
    status: resolved ? 'resolved' : 'open',
    resolvedChapter: raw.resolvedChapter ? chapterLabel(raw.resolvedChapter) : null,
    note: asPlainText(raw.note || raw['备注'], '', 200),
  };
}

function normalizeChapterSummary(value, index) {
  const raw = value && typeof value === 'object' ? value : {};
  return {
    chapter: chapterLabel(raw.chapter || raw.order || index + 1),
    title: asPlainText(raw.title || raw['标题'], `第 ${index + 1} 章`, 120),
    summary: asPlainText(raw.summary || raw.description || raw['摘要'], '', 500),
    keyEvents: asStringList(raw.keyEvents ?? raw.events ?? raw['关键事件'], 6, 120),
  };
}

/**
 * 把模型返回的故事记忆卡收敛成稳定的 JSON 结构。
 * core 只由模型分析产生；用户纠正在 corrections 中单独保存，不覆盖这里。
 */
function normalizeStoryCore(value, { chapters = [] } = {}) {
  const raw = value && typeof value === 'object' ? value : {};
  const sorted = sortChapters(chapters);

  const characters = asArray(raw.characters ?? raw['人物'])
    .filter((item) => item && typeof item === 'object')
    .slice(0, 50)
    .map(normalizeCharacter)
    .filter((item) => item.name !== '未命名角色');

  const relationships = asArray(raw.relationships ?? raw['人物关系'])
    .filter((item) => item && typeof item === 'object')
    .slice(0, 60)
    .map(normalizeRelationship)
    .filter((item) => item.from !== '未标注' || item.to !== '未标注');

  const places = asArray(raw.places ?? raw.locations ?? raw['地点'])
    .filter((item) => item && typeof item === 'object')
    .slice(0, 40)
    .map(normalizePlace)
    .filter((item) => item.name !== '未命名地点');

  const worldRules = asArray(raw.worldRules ?? raw.rules ?? raw['世界观规则'])
    .filter((item) => item && typeof item === 'object')
    .slice(0, 40)
    .map(normalizeWorldRule)
    .filter((item) => item.rule);

  const timeline = asArray(raw.timeline ?? raw['时间线'])
    .filter((item) => item && typeof item === 'object')
    .slice(0, 80)
    .map(normalizeTimelineItem)
    .filter((item) => item.event);

  const events = asArray(raw.events ?? raw['重要事件'])
    .filter((item) => item && typeof item === 'object')
    .slice(0, 80)
    .map(normalizeEvent)
    .filter((item) => item.summary);

  const seenForeshadowing = new Set();
  const foreshadowing = asArray(raw.foreshadowing ?? raw['伏笔'])
    .filter((item) => item && typeof item === 'object')
    .slice(0, 50)
    .map(normalizeForeshadowing)
    .filter((item) => {
      const key = `${item.label}-${item.plantedChapter}`;
      if (seenForeshadowing.has(key)) return false;
      seenForeshadowing.add(key);
      return true;
    });

  const rawSummaries = asArray(raw.chapterSummaries ?? raw['章节摘要']);
  const chapterSummaries = rawSummaries.length
    ? rawSummaries
        .filter((item) => item && typeof item === 'object')
        .slice(0, 300)
        .map(normalizeChapterSummary)
    : sorted.map((chapter, index) => ({
        chapter: chapterLabel(chapter.order ?? index + 1),
        title: asPlainText(chapter.title, `第 ${index + 1} 章`, 120),
        summary: '本次分析未单列该章摘要，请结合原文与事件表阅读。',
        keyEvents: [],
      }));

  const currentRaw =
    raw.currentState && typeof raw.currentState === 'object' ? raw.currentState : {};
  const currentState = {
    chapter: chapterLabel(
      currentRaw.chapter || sorted[sorted.length - 1]?.order || '当前进度'
    ),
    time: asPlainText(currentRaw.time || currentRaw['时间'], '尚未标注', 100),
    location: asPlainText(currentRaw.location || currentRaw['地点'], '尚未标注', 100),
    summary: asPlainText(
      currentRaw.summary || currentRaw['摘要'],
      '尚未提取当前剧情状态。',
      600
    ),
    conflicts: asStringList(currentRaw.conflicts ?? currentRaw['冲突'], 8, 160),
  };

  return {
    summary: asPlainText(
      raw.summary || raw.overallSummary || raw['整体摘要'],
      '尚未提取整体故事摘要。',
      800
    ),
    characters,
    relationships,
    places,
    worldRules,
    timeline,
    events,
    foreshadowing,
    currentState,
    immutableFacts: asStringList(
      raw.immutableFacts ?? raw.facts ?? raw['不可改事实'],
      40,
      240
    ),
    chapterSummaries,
  };
}

function emptyStoryCore(chapters = []) {
  return normalizeStoryCore({}, { chapters });
}

function compactCoreForPrompt(core) {
  if (!core) return '（暂无旧版故事记忆卡）';
  const characters = (core.characters || [])
    .slice(0, 24)
    .map(
      (item) =>
        `${item.name}｜${item.role}｜性格：${(item.traits || []).join('、') || '未标注'}｜已知：${item.knowledge || '未标注'}｜状态：${item.status || '未标注'}`
    )
    .join('\n');
  const relationships = (core.relationships || [])
    .slice(0, 30)
    .map((item) => `${item.from} → ${item.to}：${item.type}（${item.status}）${item.description || ''}`)
    .join('\n');
  const rules = (core.worldRules || [])
    .slice(0, 24)
    .map((item) => `${item.name}：${item.rule}`)
    .join('\n');
  const openForeshadowing = (core.foreshadowing || [])
    .filter((item) => item.status === 'open')
    .slice(0, 24)
    .map((item) => `${item.label}（埋于 ${item.plantedChapter}）：${item.description}`)
    .join('\n');
  const summaries = (core.chapterSummaries || [])
    .slice(-24)
    .map((item) => `${item.chapter}《${item.title}》：${item.summary}`)
    .join('\n');
  const facts = (core.immutableFacts || []).slice(0, 24).join('\n');

  return [
    `整体摘要：${core.summary || '无'}`,
    `当前状态：${core.currentState?.chapter || '未知'}｜${core.currentState?.time || '时间未知'}｜${core.currentState?.location || '地点未知'}`,
    `当前剧情：${core.currentState?.summary || '无'}`,
    characters ? `【人物】\n${characters}` : '',
    relationships ? `【人物关系】\n${relationships}` : '',
    rules ? `【世界规则】\n${rules}` : '',
    openForeshadowing ? `【未回收伏笔】\n${openForeshadowing}` : '',
    facts ? `【不可改事实】\n${facts}` : '',
    summaries ? `【已有章节摘要】\n${summaries}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 15000);
}

function buildStoryDigest(core, maxChars = 16000) {
  return compactCoreForPrompt(core).slice(0, maxChars);
}

const BIBLE_SYSTEM_PROMPT = `你是一位长篇小说的“故事连续性编辑”。你的任务是从作者提供的章节原文中提取可长期复用的故事记忆，供后续续写和一致性检查使用。

规则：
1. 只依据提供的章节原文，不补写、不推测原文没有发生的事。无法确认的信息写“未标注”，不要编造。
2. 区分“已经发生的事实”和“人物以为/怀疑的事”。人物知道什么，必须单独记录。
3. 未回收伏笔只记录原文确实埋下、尚未明确解决的线索；已经解决的标注 resolved，并写明回收章节。
4. 时间线按故事内时间推进整理，不要按叙述顺序臆测。
5. “不可改事实”记录已经在正文中被明确固定、续写不应随意推翻的信息（死亡、身份、关键物品归属、已发生的事件等）。
6. 只输出合法 JSON，不要 Markdown 代码块，不要解释。所有数组没有内容时返回 []。`;

function buildStoryBiblePrompt({ novel, chapters, previousCore }) {
  const sorted = sortChapters(chapters);
  const selected = selectChaptersForAnalysis(sorted);
  const perChapter = Math.max(
    1200,
    Math.min(
      MAX_BIBLE_CHAPTER_CHARS,
      Math.floor(MAX_BIBLE_TOTAL_CHARS / Math.max(1, selected.length))
    )
  );

  const coverageNote =
    selected.length < sorted.length
      ? `全书共 ${sorted.length} 章；为控制上下文，下面提供开篇、最新章节与中段抽样的 ${selected.length} 章原文，其余章节请结合旧版记忆卡合并。`
      : `下面提供全部 ${sorted.length} 章原文。`;
  const chapterText = selected
    .map((chapter) => {
      const content = truncateMiddle(chapter.content, perChapter);
      return `--- ${chapterLabel(chapter.order)}《${asPlainText(chapter.title, '未命名章节', 120)}》---\n${content}`;
    })
    .join('\n\n');

  const previous = compactCoreForPrompt(previousCore);
  const user = `小说名：《${asPlainText(novel.title, '未命名小说', 120)}》
${novel.description ? `作者简介/设定说明：${asPlainText(novel.description, '', 1200)}\n` : ''}
${coverageNote}

【旧版故事记忆卡】
${previous}

【本次需要纳入分析的章节原文】
${chapterText}

请输出以下 JSON：
{
  "summary": "整体故事摘要，300 字以内",
  "characters": [
    {
      "name": "人物名",
      "role": "身份/叙事功能",
      "traits": ["性格或行为特征"],
      "relationships": ["与某人的关系，一句话"],
      "knowledge": "截至最新章节，这个人明确知道什么、不知道什么，务必写清信息边界",
      "status": "存活/死亡/失踪/立场等",
      "arc": "人物弧光或当前变化",
      "firstChapter": "首次出现章节"
    }
  ],
  "relationships": [
    { "from": "人物A", "to": "人物B", "type": "关系", "description": "当前关系细节", "status": "当前有效/已破裂/已和解等" }
  ],
  "places": [
    { "name": "地点", "description": "外观与叙事作用", "rules": "该地点的特殊规则或限制", "firstChapter": "首次出现章节" }
  ],
  "worldRules": [
    { "name": "规则名", "rule": "不能违背的世界观规则", "evidence": "原文依据" }
  ],
  "timeline": [
    { "chapter": "章节", "time": "故事内时间", "event": "发生了什么", "impact": "对后续的影响" }
  ],
  "events": [
    { "chapter": "章节", "title": "事件名", "summary": "事件经过", "impact": "留下的后果" }
  ],
  "foreshadowing": [
    { "id": "foreshadowing-1", "label": "伏笔名称", "description": "埋了什么", "plantedChapter": "埋设章节", "status": "open", "resolvedChapter": null, "note": "可能指向什么，若原文未说明则写未标注" }
  ],
  "currentState": {
    "chapter": "当前推进到的章节",
    "time": "当前故事内时间",
    "location": "当前主要地点",
    "summary": "当前剧情状态，200 字以内",
    "conflicts": ["当前仍未解决的冲突"]
  },
  "immutableFacts": ["已经被正文固定、后续不能随意改变的事实"],
  "chapterSummaries": [
    { "chapter": "章节", "title": "章节标题", "summary": "本章摘要，120 字以内", "keyEvents": ["关键事件"] }
  ]
}

如果提供了旧版记忆卡，请合并旧信息与本次章节，输出完整的新版记忆卡；旧信息被新章节明确推翻时，以新章节为准，并在 immutableFacts 中保留“已经发生”的历史事实。`;

  return {
    system: BIBLE_SYSTEM_PROMPT,
    user,
    temperature: 0.2,
  };
}

async function analyzeStoryBible({ novel, chapters, previousCore }) {
  const sorted = sortChapters(chapters);
  if (!sorted.length) {
    throw new AppError(400, 'NO_CHAPTERS', '请先导入至少一章正文，再分析故事记忆卡');
  }
  const prompt = buildStoryBiblePrompt({ novel, chapters: sorted, previousCore });
  const response = await callLlm({ ...prompt, label: 'novel-bible' });
  let parsed;
  try {
    parsed = parseJsonLoose(response.content);
  } catch {
    throw new AppError(
      502,
      'LLM_BAD_JSON',
      '模型返回的故事记忆卡不是合法 JSON，请重新分析一次'
    );
  }
  const core = normalizeStoryCore(parsed, { chapters: sorted });
  if (!core.characters.length && !core.events.length) {
    throw new AppError(
      502,
      'LLM_BAD_JSON',
      '模型没有提取出可用的人物或事件，请重新分析一次'
    );
  }
  return { core, sourceChapters: sorted.length };
}

/* ------------------------------------------------------------------ */
/* 风格档案与上下文                                                    */
/* ------------------------------------------------------------------ */

function selectStyleTexts(chapters, maxChars = 60000, maxChapters = 10) {
  const sorted = sortChapters(chapters);
  const selected = [];
  let total = 0;
  // 从最新章节往前选，越新的章节越能代表当前笔法。
  for (let index = sorted.length - 1; index >= 0 && selected.length < maxChapters; index -= 1) {
    const content = String(sorted[index].content || '').trim();
    if (!content) continue;
    const remaining = maxChars - total;
    if (remaining <= 0) break;
    const text = content.length > remaining ? content.slice(0, remaining) : content;
    if (text.length < 20) continue;
    selected.unshift(text);
    total += text.length;
  }
  return selected;
}

async function buildStyleProfileDraft({ novel, chapters }) {
  const { analyzeStats, extractSemantic } = require('./style');
  const texts = selectStyleTexts(chapters);
  if (!texts.length) {
    throw new AppError(400, 'NO_CHAPTERS', '章节正文太少，暂时无法生成文风档案');
  }
  const stats = analyzeStats(texts);
  const { semantic } = await extractSemantic(texts);
  return {
    name: `${asPlainText(novel.title, '小说', 24)} · 文风`,
    stats,
    semantic,
    texts,
  };
}

function styleContext(profile) {
  if (!profile) {
    return '本次没有绑定笔迹档案。请严格模仿已有章节的叙述方式，不要突然改变人称、句长习惯或对白风格。';
  }
  const texts = Array.isArray(profile.texts)
    ? profile.texts.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const excerpts = [];
  if (texts.length) {
    excerpts.push(truncateMiddle(texts[texts.length - 1], MAX_STYLE_EXCERPT_CHARS));
  }
  if (texts.length > 1) {
    excerpts.push(truncateMiddle(texts[0], MAX_STYLE_EXCERPT_CHARS));
  }
  return [
    `笔迹档案：《${asPlainText(profile.name, '未命名档案', 40)}》`,
    buildProfileDirective(profile),
    excerpts.length ? `【风格样例】\n${excerpts.join('\n\n---\n\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function buildRecentChapterContext(chapters, { maxTotal = MAX_CONTEXT_TOTAL_CHARS, maxPerChapter = MAX_CONTEXT_CHAPTER_CHARS } = {}) {
  const sorted = sortChapters(chapters);
  const selected = [];
  let remaining = maxTotal;
  for (let index = sorted.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const chapter = sorted[index];
    const content = String(chapter.content || '').trim();
    if (!content) continue;
    const budget = Math.min(maxPerChapter, remaining);
    const excerpt = truncateMiddle(content, budget);
    selected.unshift(
      `--- ${chapterLabel(chapter.order)}《${asPlainText(chapter.title, '未命名章节', 120)}》---\n${excerpt}`
    );
    remaining -= excerpt.length;
    if (selected.length >= 3) break;
  }
  return {
    text: selected.join('\n\n'),
    includedOrders: sorted
      .slice(Math.max(0, sorted.length - selected.length))
      .map((chapter) => chapter.order),
  };
}

function buildOlderChapterSummary(core, latestOrders, maxCount = 24) {
  if (!core || !Array.isArray(core.chapterSummaries)) return '';
  const included = new Set((latestOrders || []).map((order) => `第 ${order} 章`));
  const summaries = core.chapterSummaries
    .filter((item) => !included.has(String(item.chapter).replace(/\s+/g, ' ')))
    .slice(-maxCount)
    .map((item) => `${item.chapter}《${item.title}》：${item.summary}`)
    .join('\n');
  return summaries ? `【更早章节摘要】\n${summaries}` : '';
}

function buildContinuationPrompt({
  novel,
  chapters,
  bible,
  profile,
  requirements = '',
  targetLength = 1500,
  narrator,
  plotDirection = '',
  strictSettings = true,
}) {
  const sorted = sortChapters(chapters);
  const recent = buildRecentChapterContext(sorted, {
    maxTotal: 20000,
    maxPerChapter: 10000,
  });
  const earlier = buildOlderChapterSummary(bible?.core, recent.includedOrders);
  const style = styleContext(profile);
  const core = bible?.core || emptyStoryCore(sorted);
  const digest = buildStoryDigest(core, 16000);
  const corrections = normalizeCorrections(bible?.corrections).notes;
  const correctionText = corrections.length
    ? corrections
        .slice(-20)
        .map((item) => `[${correctionLabel(item.type)}] ${item.target ? `${item.target}：` : ''}${item.content}`)
        .join('\n')
    : '（作者没有额外纠正或补充设定）';

  const length = Math.round(clamp(asNumber(targetLength, 1500), 400, 3000));
  // 单个候选越长，候选数量越少，避免超过模型单次输出上限；始终提供 2–3 个候选。
  const candidateCount = length > 1800 ? 2 : 3;
  const strict = strictSettings
    ? '必须严格遵守故事记忆卡中的既有设定、人物认知边界、时间线和世界观规则。若续写要求与设定冲突，优先保住设定，并在 summary 中说明你如何避开了冲突。'
    : '以既有设定为基础，可以引入新的小设定或信息，但不得推翻已经发生的事实，也不得让人物凭空知道他不该知道的事。';

  const user = `请为下面的长篇小说续写下一章，并给出 ${candidateCount} 个方向明显不同的候选稿。

【小说】《${asPlainText(novel.title, '未命名小说', 120)}》
【叙事视角】${narratorDirective(narrator || novel.narrator)}
【期望单稿长度】约 ${length} 个汉字（可上下浮动 15%，不要为了凑字数重复）
【剧情方向】${asPlainText(plotDirection, '', 500) || '由你根据当前冲突选择最自然的推进方向'}
【续写要求】${asPlainText(requirements, '', 3000) || '顺着当前章节自然推进，保持悬念与人物逻辑'}
【设定遵守】${strict}

【故事记忆卡】
${digest}

【作者纠正与补充设定】
${correctionText}

【笔迹与文风】
${style}

【更早章节摘要】
${earlier || '（无）'}

【最近章节原文】
${recent.text || '（暂无章节原文）'}

写作要求：
1. 从“最近章节原文”的结尾之后直接续写，不要重写上一章，不要在正文里加“第 X 章”标题或作者说明。
2. ${candidateCount} 个候选必须有实质差异：冲突切入点、信息揭示程度或人物选择至少有一项不同，不能只换措辞。
3. 每个候选都要推进剧情，不要用大段总结代替场景；对话、动作、心理描写保持与既有章节同一笔法。
4. 严格遵守人物已知信息边界。不要在候选里让角色突然知道记忆卡中“不知道”的事，除非本稿明确写了他是如何得知的。
5. 未回收伏笔可以选择推进或继续埋着，但不要无解释地当作已经解决。
6. 只输出合法 JSON，不要 Markdown 代码块，不要额外解释。结构如下：
{
  "candidates": [
    {
      "title": "候选稿标题（不是章节号，可以是本章的意象或事件名）",
      "direction": "这个方向的一句话标签，例如：让主角先发现物证 / 从配角视角切入 / 提前引爆冲突",
      "summary": "本稿会推进什么、揭示到什么程度、结尾停在哪里，120 字以内",
      "content": "完整续写正文，约 ${length} 字，使用 \\n 分段"
    }
  ]
}`;

  return {
    system:
      '你是一位擅长长篇小说连续创作的中文小说家，也是一位严谨的连续性编辑。你先服从故事事实和人物信息边界，再考虑文采。你只输出合法 JSON，不写 Markdown 代码块或解释。',
    user,
    temperature: 0.82,
    candidateCount,
    targetLength: length,
  };
}

function normalizeCandidate(value, index, desiredLength) {
  const raw = value && typeof value === 'object' ? value : {};
  let content = String(raw.content || raw.text || raw.body || raw['正文'] || '').trim();
  content = content
    .replace(/^```(?:markdown|text)?\s*/i, '')
    .replace(/\s*```$/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!content) return null;
  if (content.length > 30000) content = content.slice(0, 30000);
  const title = asPlainText(
    raw.title || raw['标题'],
    `续写候选 ${index + 1}`,
    120
  );
  const direction = asPlainText(
    raw.direction || raw.angle || raw['方向'],
    `方向 ${index + 1}`,
    160
  );
  const summary = asPlainText(
    raw.summary || raw.outline || raw['摘要'],
    `约 ${countChars(content)} 字，具体走向见正文。`,
    400
  );
  return {
    id: `candidate-${index + 1}`,
    title,
    direction,
    summary,
    content,
    charCount: countChars(content),
    targetLength: desiredLength,
  };
}

function parseGeneratedCandidates(text, { desiredLength = 1500 } = {}) {
  let parsed;
  try {
    parsed = parseJsonLoose(text);
  } catch {
    throw new AppError(
      502,
      'LLM_BAD_JSON',
      '模型返回的续写候选不是合法 JSON，请重新生成一次'
    );
  }
  const rawList = Array.isArray(parsed)
    ? parsed
    : asArray(parsed?.candidates || parsed?.['候选'] || parsed?.variants);
  const candidates = rawList
    .slice(0, 3)
    .map((item, index) => normalizeCandidate(item, index, desiredLength))
    .filter((item) => item && item.content.length >= 80);

  if (candidates.length < 2) {
    throw new AppError(
      502,
      'LLM_BAD_JSON',
      '模型没有返回足够完整的 2–3 个候选稿，请重新生成一次'
    );
  }
  return candidates;
}

async function generateNovelCandidates(options) {
  const prompt = buildContinuationPrompt(options);
  const response = await callLlm({
    system: prompt.system,
    user: prompt.user,
    temperature: prompt.temperature,
    label: 'novel-continue',
  });
  return {
    candidates: parseGeneratedCandidates(response.content, {
      desiredLength: prompt.targetLength,
    }),
    meta: {
      candidateCount: prompt.candidateCount,
      targetLength: prompt.targetLength,
      narrator: options.narrator || options.novel.narrator,
      narratorLabel: narratorLabel(options.narrator || options.novel.narrator),
      strictSettings: options.strictSettings !== false,
    },
  };
}

/* ------------------------------------------------------------------ */
/* 一致性检查                                                          */
/* ------------------------------------------------------------------ */

const CONSISTENCY_DIMENSIONS = [
  { key: 'character', label: '人物一致性' },
  { key: 'relationship', label: '人物关系' },
  { key: 'timeline', label: '时间线' },
  { key: 'worldRule', label: '世界观规则' },
  { key: 'foreshadowing', label: '伏笔处理' },
  { key: 'style', label: '文风接近度' },
];

const DIMENSION_ALIASES = {
  character: 'character',
  人物: 'character',
  relationship: 'relationship',
  关系: 'relationship',
  timeline: 'timeline',
  时间线: 'timeline',
  worldRule: 'worldRule',
  'world-rule': 'worldRule',
  世界观: 'worldRule',
  rule: 'worldRule',
  foreshadowing: 'foreshadowing',
  伏笔: 'foreshadowing',
  style: 'style',
  文风: 'style',
  语言风格: 'style',
};

function normalizeDimensionKey(value) {
  const raw = String(value || '').trim();
  return DIMENSION_ALIASES[raw] || DIMENSION_ALIASES[raw.toLowerCase()] || 'character';
}

function buildConsistencyPrompt({ novel, chapters, bible, profile, draft, title }) {
  const recent = buildRecentChapterContext(chapters, {
    maxTotal: 12000,
    maxPerChapter: 7000,
  });
  const digest = buildStoryDigest(bible?.core, 17000);
  const corrections = normalizeCorrections(bible?.corrections).notes;
  const correctionText = corrections.length
    ? corrections
        .slice(-20)
        .map((item) => `[${correctionLabel(item.type)}] ${item.target ? `${item.target}：` : ''}${item.content}`)
        .join('\n')
    : '（无额外纠正）';
  const paragraphs = String(draft)
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const numbered = paragraphs
    .map((paragraph, index) => `[第 ${index + 1} 段] ${paragraph}`)
    .join('\n');

  const user = `你是一位长篇小说的一致性审校编辑。请对照故事记忆卡、作者纠正和最近章节原文，审查下面这份续写稿。不要只给总分，必须指出具体问题及其在稿中的位置。

【小说】《${asPlainText(novel.title, '未命名小说', 120)}》
【待检查稿件】${asPlainText(title, '未命名续写', 120)}

【故事记忆卡】
${digest}

【作者纠正与补充设定】
${correctionText}

【最近章节原文（用于衔接判断）】
${recent.text || '（无）'}

【待检查续写稿（按段落编号）】
${numbered}

请重点检查：
1. 人物一致性：性格、能力、已知信息边界、生死/身份状态是否矛盾；角色是否突然知道了他不该知道的事。
2. 人物关系：关系状态、称呼、立场是否与设定冲突。
3. 时间线：故事内时间、地点移动、因果先后是否成立。
4. 世界观规则：是否违背已明确建立的规则。
5. 伏笔处理：是否把未回收伏笔当作已解决、重复埋设、或让人物无依据地知道真相。
6. 文风接近度：是否偏离既有章节的人称、句长、对白习惯和叙事节奏。

如果某项没有问题，分数可以高，issues 中不要硬凑。每个问题都要给出稿件中的具体位置和原文片段；位置用“第 N 段”或“第 N 段第 M 句”。没有把握时写“存疑”，不要编造设定。

只输出合法 JSON，不要 Markdown 代码块，不要解释：
{
  "overall": "一句到三句总体判断，说明最需要作者处理什么",
  "dimensionScores": {
    "character": 0,
    "relationship": 0,
    "timeline": 0,
    "worldRule": 0,
    "foreshadowing": 0,
    "style": 0
  },
  "issues": [
    {
      "dimension": "character|relationship|timeline|worldRule|foreshadowing|style",
      "severity": "high|medium|low",
      "location": "第 2 段第 3 句",
      "excerpt": "稿件中的原文片段，必须逐字引用",
      "problem": "具体矛盾是什么",
      "evidence": "故事记忆卡或原文中的依据；没有明确依据就写存疑",
      "suggestion": "可直接执行的修改建议"
    }
  ]
}

dimensionScores 均为 0–100 的整数，100 表示没有发现问题。issues 按严重程度排序。`;

  return {
    system:
      '你是一位严谨的中文长篇小说连续性编辑。你只根据提供的故事记忆卡、作者纠正和章节原文判断，不臆造设定。你只输出合法 JSON，不写 Markdown。',
    user,
    temperature: 0.15,
  };
}

function normalizeConsistency(value, { styleScore = null } = {}) {
  const raw = value && typeof value === 'object' ? value : {};
  const rawScores =
    raw.dimensionScores && typeof raw.dimensionScores === 'object'
      ? raw.dimensionScores
      : raw.scores && typeof raw.scores === 'object'
        ? raw.scores
        : {};

  const scores = {};
  for (const dimension of CONSISTENCY_DIMENSIONS) {
    const aliasKeys = Object.keys(DIMENSION_ALIASES).filter(
      (key) => DIMENSION_ALIASES[key] === dimension.key
    );
    const found = aliasKeys.find((key) => rawScores[key] !== undefined);
    scores[dimension.key] = asScore(found ? rawScores[found] : 70);
  }

  const localStyleScore =
    styleScore && Number.isFinite(Number(styleScore.personalFit))
      ? Number(styleScore.personalFit)
      : styleScore && Number.isFinite(Number(styleScore.score))
        ? Number(styleScore.score)
        : null;
  if (localStyleScore !== null) {
    scores.style = Math.round(clamp(localStyleScore, 0, 100));
  }

  const rawIssues = asArray(raw.issues || raw.problems || raw['问题']);
  const issues = rawIssues
    .filter((item) => item && typeof item === 'object')
    .slice(0, 30)
    .map((item, index) => {
      const dimension = normalizeDimensionKey(item.dimension || item.type || item['维度']);
      const severityRaw = String(item.severity || item['严重程度'] || '').toLowerCase();
      const severity = ['high', 'medium', 'low'].includes(severityRaw)
        ? severityRaw
        : /高|严重/.test(severityRaw)
          ? 'high'
          : /低|轻微/.test(severityRaw)
            ? 'low'
            : 'medium';
      return {
        id: `consistency-${index + 1}`,
        dimension,
        dimensionLabel:
          CONSISTENCY_DIMENSIONS.find((entry) => entry.key === dimension)?.label || '其他',
        severity,
        location: asPlainText(item.location || item.position || item['位置'], '未标注位置', 100),
        excerpt: asPlainText(item.excerpt || item.quote || item['原文'], '', 300),
        problem: asPlainText(item.problem || item.reason || item['问题'], '未说明具体问题', 400),
        evidence: asPlainText(item.evidence || item.basis || item['依据'], '存疑', 300),
        suggestion: asPlainText(item.suggestion || item.fix || item['建议'], '按设定调整这一段。', 300),
      };
    });

  // 本地风格检测是确定性的补充：即使模型漏判，也会指出具体句子层面的偏离。
  if (styleScore && Array.isArray(styleScore.issues)) {
    const styleIssues = styleScore.issues
      .filter((issue) => issue.type === 'deviation' || issue.severity === 'high')
      .slice(0, 3);
    for (const issue of styleIssues) {
      const already = issues.some(
        (entry) => entry.dimension === 'style' && entry.excerpt && entry.excerpt === issue.sentence
      );
      if (already) continue;
      issues.push({
        id: `consistency-local-${issues.length + 1}`,
        dimension: 'style',
        dimensionLabel: '文风接近度',
        severity: issue.severity || 'medium',
        location: issue.paragraph ? `第 ${issue.paragraph} 段` : '全文节奏',
        excerpt: issue.sentence || '',
        problem: issue.reason,
        evidence: '与已保存笔迹档案的句长、正式度或用词基线对比',
        suggestion: issue.suggestion || '按照档案的节奏调整句式和用词。',
      });
    }
  }

  const severityRank = { high: 0, medium: 1, low: 2 };
  issues.sort((a, b) => {
    const rank = severityRank[a.severity] - severityRank[b.severity];
    if (rank !== 0) return rank;
    return a.dimension.localeCompare(b.dimension);
  });

  const dimensions = CONSISTENCY_DIMENSIONS.map((dimension) => ({
    ...dimension,
    score: scores[dimension.key],
    issueCount: issues.filter((issue) => issue.dimension === dimension.key).length,
  }));
  const overallScore = Math.round(
    dimensions.reduce((sum, item) => sum + item.score, 0) / dimensions.length
  );
  const highCount = issues.filter((issue) => issue.severity === 'high').length;

  return {
    overall: asPlainText(
      raw.overall || raw.summary || raw['总体判断'],
      highCount
        ? `发现 ${highCount} 处需要优先处理的一致性问题。`
        : '没有发现严重设定冲突，可以结合下面的细节再读一遍。',
      500
    ),
    overallScore,
    passed: highCount === 0 && overallScore >= 70,
    dimensions,
    issues,
    style: styleScore
      ? {
          score: styleScore.score,
          level: styleScore.level,
          aiFlavor: styleScore.aiFlavor,
          personalFit: styleScore.personalFit,
          profileUsed: styleScore.profileUsed,
          highlights: styleScore.highlights,
        }
      : null,
  };
}

async function checkNovelConsistency({ novel, chapters, bible, profile, draft, title }) {
  const prompt = buildConsistencyPrompt({ novel, chapters, bible, profile, draft, title });
  const response = await callLlm({ ...prompt, label: 'novel-consistency' });
  let parsed;
  try {
    parsed = parseJsonLoose(response.content);
  } catch {
    throw new AppError(
      502,
      'LLM_BAD_JSON',
      '模型返回的一致性检查结果不是合法 JSON，请重新检查一次'
    );
  }
  const styleScore = profile
    ? scoreContent({ content: draft, profile, platform: null })
    : null;
  return normalizeConsistency(parsed, { styleScore });
}

/* ------------------------------------------------------------------ */
/* 纠正与补充设定                                                      */
/* ------------------------------------------------------------------ */

function correctionLabel(type) {
  return CORRECTION_TYPES.find((item) => item.key === type)?.label || '其他';
}

function normalizeCorrections(value) {
  const raw = value && typeof value === 'object' ? value : {};
  const notes = asArray(raw.notes || raw.items || raw['纠错'])
    .filter((item) => item && typeof item === 'object')
    .slice(-100)
    .map((item, index) => {
      const type = CORRECTION_TYPE_KEYS.has(item.type) ? item.type : 'other';
      return {
        id: asPlainText(item.id, `correction-${index + 1}`, 60),
        type,
        typeLabel: correctionLabel(type),
        target: asPlainText(item.target || item['对象'], '', 100),
        content: asPlainText(item.content || item.note || item['内容'], '', 800),
        createdAt: asPlainText(item.createdAt, '', 40),
      };
    })
    .filter((item) => item.content);
  return { notes };
}

function appendCorrection(existing, { type, target, content }) {
  const normalized = normalizeCorrections(existing);
  const note = {
    id: `correction-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: CORRECTION_TYPE_KEYS.has(type) ? type : 'other',
    typeLabel: correctionLabel(type),
    target: asPlainText(target, '', 100),
    content: asPlainText(content, '', 800),
    createdAt: new Date().toISOString(),
  };
  if (!note.content) {
    throw new AppError(400, 'INVALID_CORRECTION', '纠正内容不能为空');
  }
  const notes = [...normalized.notes, note].slice(-100);
  return { corrections: { notes }, note };
}

/* ------------------------------------------------------------------ */
/* 小说助手                                                            */
/* ------------------------------------------------------------------ */

function buildNovelAssistantSystem({ novel, chapters, bible }) {
  const sorted = sortChapters(chapters);
  const recent = buildRecentChapterContext(sorted, {
    maxTotal: 10000,
    maxPerChapter: 6000,
  });
  const digest = buildStoryDigest(bible?.core, 15000);
  const earlier = buildOlderChapterSummary(bible?.core, recent.includedOrders);
  const corrections = normalizeCorrections(bible?.corrections).notes;
  const correctionText = corrections.length
    ? corrections
        .slice(-20)
        .map((item) => `[${correctionLabel(item.type)}] ${item.target ? `${item.target}：` : ''}${item.content}`)
        .join('\n')
    : '（无）';

  return `你是《${asPlainText(novel.title, '未命名小说', 120)}》的专属小说助手，熟悉这本书的故事记忆卡、章节摘要和最近章节原文。

你的任务是回答作者关于本书的问题，尤其擅长：
- 某个角色目前知道什么、不知道什么；
- 还有哪些未回收伏笔；
- 下一章可以往哪些方向推进；
- 某段续写是否违反世界观规则；
- 人物行为、关系和时间线是否一致。

【故事记忆卡】
${digest}

【作者纠正与补充设定（优先级高于模型提取结果）】
${correctionText}

【更早章节摘要】
${earlier || '（无）'}

【最近章节原文（可能只是节选，注意标注）】
${recent.text || '（暂无章节原文）'}

回答规则：
1. 只依据上下文回答。信息不足时明确说“现有记忆卡里没有记录，需要回看第 X 章”，不要编造。
2. 回答“谁知道什么”时，要区分“亲历”“被告知”“推断”“并不知道”。
3. 回答伏笔时，先列未回收的，再列已回收的，并注明埋设章节。
4. 提出下一章方向时，要说明它如何利用现有冲突或伏笔，不要给泛泛的写作建议。
5. 如果作者在问具体改稿，尽量引用相关章节或记忆卡依据；不要假装读过未提供的全文。
6. 用中文回答，直接回应用户的问题；需要分点时用数字或换行。不要写成模板化报告，也不要使用 Markdown 标题、加粗符号、表格或代码块。`;
}

function buildNovelAssistantPrompt({ novel, chapters, bible, messages }) {
  return {
    system: buildNovelAssistantSystem({ novel, chapters, bible }),
    messages: normalizeMessages(messages),
    temperature: 0.4,
  };
}

async function answerNovelQuestion({ novel, chapters, bible, messages }) {
  const prompt = buildNovelAssistantPrompt({ novel, chapters, bible, messages });
  const result = await callLlmMessages({
    system: prompt.system,
    messages: prompt.messages,
    temperature: prompt.temperature,
    label: 'novel-assistant',
  });
  return { reply: result.content };
}

module.exports = {
  NARRATORS,
  CORRECTION_TYPES,
  CONSISTENCY_DIMENSIONS,
  NARRATOR_KEYS,
  MAX_BIBLE_TOTAL_CHARS,
  MAX_CONTEXT_TOTAL_CHARS,
  analyzeStoryBible,
  answerNovelQuestion,
  appendCorrection,
  buildConsistencyPrompt,
  buildContinuationPrompt,
  buildNovelAssistantPrompt,
  buildNovelAssistantSystem,
  buildStoryBiblePrompt,
  buildStoryDigest,
  buildStyleProfileDraft,
  chapterLabel,
  checkNovelConsistency,
  compactCoreForPrompt,
  countChars,
  emptyStoryCore,
  generateNovelCandidates,
  normalizeConsistency,
  normalizeCorrections,
  normalizeStoryCore,
  narratorLabel,
  parseGeneratedCandidates,
  parseJsonLoose,
  selectChaptersForAnalysis,
  selectStyleTexts,
  sortChapters,
  styleContext,
  truncateMiddle,
};
