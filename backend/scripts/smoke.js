const path = require('node:path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
// 离线检查：强制无 Key，确保不会发出真实模型请求。
process.env.LLM_API_KEY = '';

const assert = require('node:assert');
const fs = require('node:fs');
const config = require('../src/config');
const llm = require('../src/services/llm');
const { buildSemanticPrompt } = require('../src/services/style');
const { buildGeneratePrompt, generateText } = require('../src/services/generate');
const {
  buildRewritePrompt,
  rewriteContent,
  evaluateRewriteGuard,
} = require('../src/services/rewrite');
const { scoreContent } = require('../src/services/score');
const {
  DEMO_WRITING,
  OPINION_ARTICLES,
  WORK_PROFILE,
  LIFE_PROFILE,
} = require('../src/demo/demoData');
const responses = require('../src/demo/demoResponses');

const failures = [];

async function expectNotConfigured(label, fn) {
  try {
    await fn();
    throw new Error('应当抛出 LLM_NOT_CONFIGURED，但没有报错');
  } catch (error) {
    assert.strictEqual(error.code, 'LLM_NOT_CONFIGURED', `${label} 错误码应为 LLM_NOT_CONFIGURED`);
    assert.strictEqual(error.status, 503, `${label} 状态码应为 503`);
    console.log(`  ✓ ${label.padEnd(28)} ${error.code} / ${error.status}`);
  }
}

function checkScoreDeterminism() {
  const score = scoreContent({
    content: responses.wechatLife,
    profile: LIFE_PROFILE,
    platform: 'wechat',
  });
  const again = scoreContent({
    content: responses.wechatLife,
    profile: LIFE_PROFILE,
    platform: 'wechat',
  });
  assert.deepStrictEqual(
    { score: score.score, issues: score.issues, stats: score.stats },
    { score: again.score, issues: again.issues, stats: again.stats },
    '同一文本的评分应当可复现'
  );
  assert.ok(score.issues.length >= 2, '随笔生活示例应至少检测出两个具体问题');
  assert.ok(
    score.issues.some((issue) => issue.reason.includes('值得注意的是')),
    '应命中“值得注意的是”套话'
  );
  console.log(
    `  ✓ 评分确定性与问题定位 · ${score.score} 分 / ${score.issues.length} 个问题`
  );
  return score;
}

function checkPrompts(lifeScore) {
  const generateA = buildGeneratePrompt({
    topic: DEMO_WRITING.topic,
    platform: 'wechat',
    profile: LIFE_PROFILE,
    tuningEnabled: true,
    tuning: DEMO_WRITING.tuning,
  });
  const generateB = buildGeneratePrompt({
    topic: DEMO_WRITING.topic,
    platform: 'wechat',
    profile: LIFE_PROFILE,
    tuningEnabled: true,
    tuning: DEMO_WRITING.tuning,
  });
  assert.deepStrictEqual(generateA, generateB, '生成提示词应可复现');
  assert.ok(generateA.user.includes('公众号'), '生成提示词应包含平台要求');
  assert.ok(generateA.user.includes('档案摘要'), '生成提示词应包含档案信息');

  const rewrite = buildRewritePrompt({
    content: responses.wechatLife,
    problems: lifeScore.issues,
    profile: LIFE_PROFILE,
    platform: 'wechat',
    topic: DEMO_WRITING.topic,
  });
  assert.ok(rewrite.user.includes('值得注意的是'), '重写提示词应包含问题清单');
  assert.throws(
    () => buildRewritePrompt({ content: '   ', problems: [] }),
    (error) => error.code === 'INVALID_CONTENT',
    '空正文构建重写提示词应报错'
  );

  const semantic = buildSemanticPrompt(OPINION_ARTICLES);
  const semanticAgain = buildSemanticPrompt(OPINION_ARTICLES);
  assert.deepStrictEqual(semantic, semanticAgain, '语义提示词应可复现');
  assert.ok(semantic.user.includes(OPINION_ARTICLES[0].slice(0, 20)), '语义提示词应包含文章');
  console.log('  ✓ 生成 / 重写 / 语义提示词构建');
}

function checkCacheFile() {
  const raw = fs.readFileSync(config.llm.cachePath, 'utf8');
  const cache = JSON.parse(raw);
  const entries = Object.entries(cache);
  assert.strictEqual(entries.length, 3, `语义缓存应为 3 条，当前 ${entries.length} 条`);
  for (const [, entry] of entries) {
    assert.ok(
      typeof entry.label === 'string' && entry.label.startsWith('profile:'),
      `缓存中不应有非语义条目：${entry.label}`
    );
    assert.strictEqual(entry.model, config.llm.model, '缓存模型应与当前配置一致');
  }
  console.log(`  ✓ 语义缓存文件 · ${entries.length} 条（${config.llm.model}）`);
}

function checkGuard(lifeScore) {
  const accepted = evaluateRewriteGuard({
    originalContent: responses.wechatLife,
    candidateContent: responses.rewriteLife,
    profile: LIFE_PROFILE,
    platform: 'wechat',
  });
  assert.strictEqual(accepted.accepted, true, '高分候选应被采用');
  assert.strictEqual(accepted.content, responses.rewriteLife.trim());
  assert.strictEqual(accepted.score.score, accepted.afterScore);
  assert.ok(accepted.afterScore >= accepted.beforeScore);
  console.log(
    `  ✓ 降分保护：接受 · ${accepted.beforeScore} → ${accepted.afterScore}`
  );

  // 整篇重写允许 5 分以内的正常波动。
  const smallDrop = `${responses.wechatLife}\n\n我坐在桌前，看着窗外的路灯一盏一盏亮起来，忽然意识到，所谓把时间还给自己，其实并不是要拒绝所有人，而是学会在必要的时候停下来，听一听自己内心的声音。`;
  const tolerated = evaluateRewriteGuard({
    originalContent: responses.wechatLife,
    candidateContent: smallDrop,
    profile: LIFE_PROFILE,
    platform: 'wechat',
  });
  assert.strictEqual(tolerated.accepted, true, '降分在 5 分以内的候选应被采用');
  assert.strictEqual(tolerated.content, smallDrop, '容忍范围内应返回改写稿');
  assert.ok(
    tolerated.beforeScore - tolerated.afterScore <= 5,
    '容忍范围用例的降分应不超过 5 分'
  );
  console.log(
    `  ✓ 降分保护：小幅下降仍采用 · ${tolerated.beforeScore} → ${tolerated.afterScore}`
  );

  const worse = `${responses.wechatLife}\n\n综上所述，值得注意的是，在当今这个快节奏的时代，我们每个人都应该积极拥抱变化，不断提升自我，迎接更加美好的未来。`;
  const rejected = evaluateRewriteGuard({
    originalContent: responses.wechatLife,
    candidateContent: worse,
    profile: LIFE_PROFILE,
    platform: 'wechat',
  });
  assert.strictEqual(rejected.accepted, false, '降分候选不应被采用');
  assert.strictEqual(rejected.content, responses.wechatLife, '拒绝时应返回原稿');
  assert.ok(
    rejected.afterScore < rejected.beforeScore - 5,
    '拒绝时候选分应比原稿低超过 5 分'
  );
  assert.strictEqual(rejected.score.score, rejected.beforeScore);
  assert.deepStrictEqual(
    { score: rejected.score.score, issues: rejected.score.issues, stats: rejected.score.stats },
    { score: lifeScore.score, issues: lifeScore.issues, stats: lifeScore.stats },
    '拒绝时返回的评分应与原稿评分一致'
  );
  console.log(
    `  ✓ 降分保护：拒绝 · ${rejected.beforeScore} → ${rejected.afterScore}（保留原稿）`
  );

  const tie = evaluateRewriteGuard({
    originalContent: responses.wechatLife,
    candidateContent: responses.wechatLife,
    profile: LIFE_PROFILE,
    platform: 'wechat',
  });
  assert.strictEqual(tie.accepted, true, '平分应接受');
  console.log(`  ✓ 降分保护：平分 · ${tie.beforeScore} → ${tie.afterScore}`);
}

async function main() {
  assert.strictEqual(llm.isConfigured(), false, 'smoke 必须在无 Key 环境运行');

  console.log('\n== 语义缓存文件 ==');
  checkCacheFile();
  assert.strictEqual(llm.getCacheStatus().entries, 3);

  console.log('\n== 无 Key 报错 ==');
  await expectNotConfigured('生成', () =>
    generateText({
      topic: DEMO_WRITING.topic,
      platform: 'wechat',
      profile: LIFE_PROFILE,
      tuningEnabled: false,
      tuning: null,
    })
  );
  await expectNotConfigured('重写', () =>
    rewriteContent({
      content: responses.wechatLife,
      problems: [],
      profile: LIFE_PROFILE,
      platform: 'wechat',
      topic: DEMO_WRITING.topic,
    })
  );
  await expectNotConfigured('档案语义分析', () =>
    llm.chat({ ...buildSemanticPrompt(OPINION_ARTICLES), label: 'profile-semantic', cache: true })
  );
  assert.strictEqual(
    llm.getCacheStatus().entries,
    3,
    '无 Key 的失败路径不应写入缓存'
  );

  console.log('\n== 提示词与评分 ==');
  checkPrompts(scoreContent({
    content: responses.wechatLife,
    profile: LIFE_PROFILE,
    platform: 'wechat',
  }));
  const lifeScore = checkScoreDeterminism();

  console.log('\n== 重写降分保护 ==');
  checkGuard(lifeScore);

  if (failures.length) {
    console.error(`\n失败 ${failures.length} 项：`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('\n离线检查全部通过（无 Key、无网络、缓存文件未变）。');
  }
}

main().catch((error) => {
  failures.push(error.message);
  console.error(`\n✗ ${error.message}`);
  process.exitCode = 1;
});
