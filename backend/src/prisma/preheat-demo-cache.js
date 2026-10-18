const fs = require('node:fs');
const path = require('node:path');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const config = require('../config');
const { makeCacheKey } = require('../services/llm');
const { buildSemanticPrompt } = require('../services/style');
const {
  WORK_ARTICLES,
  LIFE_ARTICLES,
  WORK_APPEND_ARTICLES,
  LIFE_APPEND_ARTICLES,
  OPINION_ARTICLES,
  OPINION_SEMANTIC,
  WORK_PROFILE,
  LIFE_PROFILE,
} = require('../demo/demoData');

const cachePath = config.llm.cachePath;
const createdAt = '2026-10-17T00:00:00.000Z';

// 生成/重写不读写缓存，这里只预热档案语义分析。
// 从零重建，顺带清掉旧版本写入的生成/重写条目。
const rebuilt = {};
const added = [];

function remember(label, prompt, response) {
  const key = makeCacheKey({
    system: prompt.system,
    user: prompt.user,
    temperature: prompt.temperature,
  });
  rebuilt[key] = {
    response: String(response).trim(),
    createdAt,
    model: config.llm.model,
    label,
  };
  added.push({ label, key, chars: String(response).trim().length });
}

remember(
  'profile:demo-opinion',
  buildSemanticPrompt(OPINION_ARTICLES),
  JSON.stringify(OPINION_SEMANTIC)
);

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

const sorted = Object.fromEntries(
  Object.entries(rebuilt).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
);

fs.mkdirSync(path.dirname(cachePath), { recursive: true });
fs.writeFileSync(cachePath, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');

console.log(`已写入 ${cachePath}`);
console.log(`本次重建 ${added.length} 条档案语义缓存（模型 ${config.llm.model}）。`);
for (const item of added) {
  console.log(`  - ${item.label.padEnd(24)} ${String(item.chars).padStart(4)} 字  ${item.key.slice(0, 8)}`);
}
