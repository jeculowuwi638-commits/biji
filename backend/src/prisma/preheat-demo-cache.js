const fs = require('node:fs');
const path = require('node:path');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const config = require('../config');
const { makeCacheKey } = require('../services/llm');
const { buildSemanticPrompt } = require('../services/style');
const { buildGeneratePrompt } = require('../services/generate');
const { buildRewritePrompt } = require('../services/rewrite');
const { scoreContent } = require('../services/score');
const {
  DEMO_WRITING,
  WORK_ARTICLES,
  LIFE_ARTICLES,
  WORK_APPEND_ARTICLES,
  LIFE_APPEND_ARTICLES,
  OPINION_ARTICLES,
  OPINION_SEMANTIC,
  WORK_PROFILE,
  LIFE_PROFILE,
} = require('../demo/demoData');
const responses = require('../demo/demoResponses');

const cachePath = config.llm.cachePath;
const createdAt = '2026-10-17T00:00:00.000Z';

function readExisting() {
  try {
    if (!fs.existsSync(cachePath)) return {};
    const raw = fs.readFileSync(cachePath, 'utf8');
    const parsed = raw.trim() ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

const merged = { ...readExisting() };
const added = [];

// 缓存键包含 model。切换 LLM_MODEL 后，旧模型的条目永远不会命中，直接清掉。
for (const [key, entry] of Object.entries(merged)) {
  if (!entry || entry.model !== config.llm.model) delete merged[key];
}

function remember(label, prompt, response) {
  const key = makeCacheKey({
    system: prompt.system,
    user: prompt.user,
    temperature: prompt.temperature,
  });
  merged[key] = {
    response: String(response).trim(),
    createdAt,
    model: config.llm.model,
    label,
  };
  added.push({ label, key, chars: String(response).trim().length });
}

const profileSets = [
  { key: 'none', profile: null },
  { key: 'work', profile: WORK_PROFILE },
  { key: 'life', profile: LIFE_PROFILE },
];

const generateResponses = {
  wechat: {
    none: responses.wechatNone,
    work: responses.wechatWork,
    life: responses.wechatLife,
  },
  xiaohongshu: {
    none: responses.xiaohongshuNone,
    work: responses.xiaohongshuWork,
    life: responses.xiaohongshuLife,
  },
  douyin: {
    none: responses.douyinNone,
    work: responses.douyinWork,
    life: responses.douyinLife,
  },
};

// 1) 档案分析：用户点击“填入示例语料”后创建的「观点评论」档案。
remember(
  'profile:demo-opinion',
  buildSemanticPrompt(OPINION_ARTICLES),
  JSON.stringify(OPINION_SEMANTIC)
);

// 2) 演示档案追加文章：无 Key 时也能演示“继续投喂 → 重新分析”的完整流程。
remember(
  'profile:append:work',
  buildSemanticPrompt([...WORK_ARTICLES, ...WORK_APPEND_ARTICLES]),
  JSON.stringify(WORK_PROFILE.semantic)
);
remember(
  'profile:append:life',
  buildSemanticPrompt([...LIFE_ARTICLES, ...LIFE_APPEND_ARTICLES]),
  JSON.stringify(LIFE_PROFILE.semantic)
);

// 3) 三平台 × 三种档案选择，共 9 条生成缓存。
for (const platformKey of ['wechat', 'xiaohongshu', 'douyin']) {
  for (const profileSet of profileSets) {
    const prompt = buildGeneratePrompt({
      topic: DEMO_WRITING.topic,
      platform: platformKey,
      profile: profileSet.profile,
      tuningEnabled: false,
      tuning: null,
    });
    remember(
      `generate:${platformKey}:${profileSet.key}`,
      prompt,
      generateResponses[platformKey][profileSet.key]
    );
  }
}

// 4) 微调演示：随笔生活 + 更正式。
remember(
  'generate:wechat:life:tuned',
  buildGeneratePrompt({
    topic: DEMO_WRITING.topic,
    platform: DEMO_WRITING.platform,
    profile: LIFE_PROFILE,
    tuningEnabled: true,
    tuning: DEMO_WRITING.tuning,
  }),
  responses.wechatLifeTuned
);

// 5) 重写：随笔生活版本检测出的问题清单，必须与运行时评分完全一致。
const lifeScore = scoreContent({
  content: responses.wechatLife,
  profile: LIFE_PROFILE,
  platform: 'wechat',
});
const rewritePrompt = buildRewritePrompt({
  content: responses.wechatLife,
  problems: lifeScore.issues,
  profile: LIFE_PROFILE,
  platform: 'wechat',
  topic: DEMO_WRITING.topic,
});
remember('rewrite:wechat:life', rewritePrompt, responses.rewriteLife);

// 6) 第二轮重写：第一轮重写后只剩低严重度的比喻密度问题。
const rewrittenScore = scoreContent({
  content: responses.rewriteLife,
  profile: LIFE_PROFILE,
  platform: 'wechat',
});
const rewritePrompt2 = buildRewritePrompt({
  content: responses.rewriteLife,
  problems: rewrittenScore.issues,
  profile: LIFE_PROFILE,
  platform: 'wechat',
  topic: DEMO_WRITING.topic,
});
remember('rewrite:wechat:life:round2', rewritePrompt2, responses.rewriteLife2);

const sorted = Object.fromEntries(
  Object.entries(merged).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
);

fs.mkdirSync(path.dirname(cachePath), { recursive: true });
fs.writeFileSync(cachePath, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');

console.log(`已写入 ${cachePath}`);
console.log(`本次新增/更新 ${added.length} 条缓存，文件共 ${Object.keys(sorted).length} 条。`);
for (const item of added) {
  console.log(`  - ${item.label.padEnd(30)} ${String(item.chars).padStart(4)} 字  ${item.key.slice(0, 8)}`);
}

console.log('\n随笔生活版本的检测分数：', lifeScore.score, lifeScore.level);
console.log('检测问题数：', lifeScore.issues.length);
for (const issue of lifeScore.issues) {
  console.log(`  [${issue.severity}] 第${issue.paragraph || '-'}段 ${issue.reason}`);
}
console.log('\n第一轮重写后的检测分数：', rewrittenScore.score, rewrittenScore.level);
console.log('第一轮重写后的问题数：', rewrittenScore.issues.length);
for (const issue of rewrittenScore.issues) {
  console.log(`  [${issue.severity}] 第${issue.paragraph || '-'}段 ${issue.reason}`);
}
