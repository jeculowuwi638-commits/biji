const path = require('node:path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
// 离线检查：强制空 Key，验证没有 Key 时直接返回 NO_API_KEY。
process.env.LLM_API_KEY = '';

const assert = require('node:assert');
const llm = require('../src/services/llm');
const { buildSemanticPrompt } = require('../src/services/style');
const {
  buildGeneratePrompt,
  generateText,
  parseGeneratedOutput,
} = require('../src/services/generate');
const { answerQuestion, buildAssistantPrompt } = require('../src/services/assistant');
const { scoreContent } = require('../src/services/score');
const {
  DEMO_WRITING,
  OPINION_ARTICLES,
  WORK_PROFILE,
  LIFE_PROFILE,
  LIFE_ARTICLES,
} = require('../src/demo/demoData');
const responses = require('../src/demo/demoResponses');

const failures = [];

async function expectNotConfigured(label, fn) {
  try {
    await fn();
    throw new Error('应当抛出 NO_API_KEY，但没有报错');
  } catch (error) {
    assert.strictEqual(error.code, 'NO_API_KEY', `${label} 错误码应为 NO_API_KEY`);
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

function checkPrompts() {
  // 生成时档案原文是风格的主要依据，必须完整进入提示词。
  const profileWithTexts = { ...LIFE_PROFILE, texts: LIFE_ARTICLES };
  const generateA = buildGeneratePrompt({
    topic: DEMO_WRITING.topic,
    platform: 'wechat',
    profile: profileWithTexts,
    tuningEnabled: true,
    tuning: DEMO_WRITING.tuning,
  });
  const generateB = buildGeneratePrompt({
    topic: DEMO_WRITING.topic,
    platform: 'wechat',
    profile: profileWithTexts,
    tuningEnabled: true,
    tuning: DEMO_WRITING.tuning,
  });
  assert.deepStrictEqual(generateA, generateB, '生成提示词应可复现');
  assert.ok(generateA.user.includes('公众号'), '生成提示词应包含平台要求');
  assert.ok(generateA.user.includes('【作者原文】'), '生成提示词应包含原文段落');
  assert.ok(generateA.user.includes('档案摘要'), '生成提示词应包含档案摘要');
  assert.ok(generateA.user.includes('【标题】'), '生成提示词应要求模型输出标题');
  assert.ok(generateA.user.includes('【正文】'), '生成提示词应要求模型输出正文');
  for (const text of LIFE_ARTICLES) {
    assert.ok(generateA.user.includes(text), '生成提示词应完整包含每一篇档案原文');
  }

  const generateFallback = buildGeneratePrompt({
    topic: DEMO_WRITING.topic,
    platform: 'wechat',
    profile: LIFE_PROFILE,
  });
  assert.ok(
    generateFallback.user.includes('没有保存原始文章'),
    '旧档案没有原文时应降级为只使用档案摘要'
  );

  const parsed = parseGeneratedOutput(
    '【标题】把下班后的两小时留给自己\n\n【正文】\n\n以前的我，总把时间排得很满。',
    { topic: '写一件最近发生的小事' }
  );
  assert.strictEqual(parsed.title, '把下班后的两小时留给自己', '应解析出模型生成的标题');
  assert.strictEqual(parsed.content, '以前的我，总把时间排得很满。', '标题不应混进正文');

  const titleFallback = parseGeneratedOutput('只有正文，没有标题标记。', {
    topic: '第一行主题\n第二行素材',
  });
  assert.strictEqual(titleFallback.title, '第一行主题', '模型漏标题时应使用主题兜底');
  assert.strictEqual(titleFallback.content, '只有正文，没有标题标记。', '兜底时不应丢失正文');

  const bodyOnly = parseGeneratedOutput('标题在前\n【正文】\n正文在后', {
    topic: '兜底主题',
  });
  assert.strictEqual(bodyOnly.title, '标题在前', '只有正文标记时应取标记前的短行作标题');
  assert.strictEqual(bodyOnly.content, '正文在后', '正文标记后的内容应作为正文');

  const semantic = buildSemanticPrompt(OPINION_ARTICLES);
  const semanticAgain = buildSemanticPrompt(OPINION_ARTICLES);
  assert.deepStrictEqual(semantic, semanticAgain, '语义提示词应可复现');
  assert.ok(semantic.user.includes(OPINION_ARTICLES[0].slice(0, 20)), '语义提示词应包含文章');

  const assistant = buildAssistantPrompt([
    { role: 'user', content: '这句话怎么改得更自然？' },
  ]);
  assert.strictEqual(assistant.messages.length, 1, '助手初始对话应只有用户问题');
  assert.ok(
    !assistant.system.includes('档案原文') && !assistant.system.includes('作者原文'),
    '助手系统提示词不应包含档案或原文'
  );
  const assistantMulti = buildAssistantPrompt([
    { role: 'user', content: '第一问' },
    { role: 'assistant', content: '第一答' },
    { role: 'user', content: '第二问' },
  ]);
  assert.strictEqual(assistantMulti.messages.length, 3, '助手应保留多轮对话');
  assert.throws(
    () => buildAssistantPrompt([{ role: 'assistant', content: '没有提问' }]),
    (error) => error.code === 'INVALID_MESSAGES',
    '助手最后一条不是提问时应报错'
  );
  console.log('  ✓ 生成 / 语义 / 助手提示词构建');
}

async function main() {
  assert.strictEqual(llm.isConfigured(), false, 'smoke 必须在空 Key 环境运行');
  assert.strictEqual(
    typeof llm.getCacheStatus,
    'undefined',
    'LLM 出口不应再暴露缓存接口'
  );

  console.log('\n== 无 API Key ==');
  await expectNotConfigured('生成', () =>
    generateText({
      topic: DEMO_WRITING.topic,
      platform: 'wechat',
      profile: LIFE_PROFILE,
      tuningEnabled: false,
      tuning: null,
    })
  );
  await expectNotConfigured('档案语义分析', () =>
    llm.chat({ ...buildSemanticPrompt(OPINION_ARTICLES), label: 'profile-semantic' })
  );
  await expectNotConfigured('助手对话', () =>
    answerQuestion([{ role: 'user', content: '这句话怎么改得更自然？' }])
  );

  console.log('\n== 提示词与评分 ==');
  checkPrompts();
  checkScoreDeterminism();

  if (failures.length) {
    console.error(`\n失败 ${failures.length} 项：`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('\n离线检查全部通过（空 Key、无网络、不读写模型缓存）。');
  }
}

main().catch((error) => {
  failures.push(error.message);
  console.error(`\n✗ ${error.message}`);
  process.exitCode = 1;
});
