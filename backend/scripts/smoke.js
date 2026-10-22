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
  analyzeStoryBible,
  answerNovelQuestion,
  appendCorrection,
  buildContinuationPrompt,
  buildNovelAssistantPrompt,
  buildStoryBiblePrompt,
  checkNovelConsistency,
  generateNovelCandidates,
  normalizeConsistency,
  normalizeStoryCore,
  parseGeneratedCandidates,
  parseJsonLoose,
  selectChaptersForAnalysis,
} = require('../src/services/novel');
const {
  DEMO_WRITING,
  NOVEL_DEMO,
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

function makeNovelFixture() {
  const chapters = NOVEL_DEMO.chapters.map((chapter, index) => ({
    id: index + 1,
    order: index + 1,
    title: chapter.title,
    content: chapter.content,
  }));
  const core = normalizeStoryCore(
    {
      summary: '林澄回到雾港追查哥哥失踪的真相，发现白塔日志和红绳都与旧案有关。',
      characters: [
        {
          name: '林澄',
          role: '调查者，失踪船员的妹妹',
          traits: ['克制', '敏锐'],
          knowledge: '知道哥哥在白塔留下日志；不知道周砚为什么隐瞒。',
          status: '存活',
          firstChapter: '第 1 章',
        },
      ],
      relationships: [
        {
          from: '林澄',
          to: '周砚',
          type: '互相试探',
          description: '周砚知道旧案内情，但没有告诉林澄全部事实。',
          status: '紧张',
        },
      ],
      places: [{ name: '白塔', description: '港口北端的旧灯塔', rules: '夜里有人定期维护' }],
      worldRules: [
        { name: '雾港的雾', rule: '浓雾会让灯塔光只能扫到近岸，不能照见旧船厂。' },
      ],
      timeline: [
        { chapter: '第 1 章', time: '10 月 17 日晚', event: '林澄收到哥哥的旧信' },
      ],
      events: [{ chapter: '第 3 章', title: '白塔日志', summary: '林澄发现昨天的维护记录' }],
      foreshadowing: [
        { label: '第十三阶的红绳', description: '绳结是哥哥教她的双套结。', plantedChapter: '第 3 章', status: 'open' },
        { label: '旧船厂的灯', description: '灯塔扫过时曾亮起一次。', plantedChapter: '第 3 章', status: 'open' },
      ],
      currentState: {
        chapter: '第 3 章',
        time: '10 月 18 日夜',
        location: '白塔镜室',
        summary: '周砚堵在镜室门口，塔下还有另一个人。',
        conflicts: ['周砚隐瞒了什么'],
      },
      immutableFacts: ['林澄的哥哥没有被确认死亡。', '灯塔维护日志被林澄带走。'],
      chapterSummaries: [
        { chapter: '第 3 章', title: '灯塔下的红绳', summary: '林澄进入白塔，发现红绳和日志。' },
      ],
    },
    { chapters }
  );
  const corrections = appendCorrection(
    { notes: [] },
    {
      type: 'fact',
      target: '林澄的哥哥',
      content: '正文只说他失踪，没有确认死亡；续写不能把他写成已确认死亡。',
    }
  ).corrections;
  return {
    novel: {
      id: 1,
      title: '雾港来信',
      description: '港口悬疑长篇。',
      narrator: 'third-limited',
      strictSettings: true,
    },
    chapters,
    bible: { core, corrections, sourceChapters: chapters.length },
    profile: null,
  };
}

function checkNovelToleranceAndPrompts() {
  const tolerant = parseJsonLoose(
    '模型说明在 JSON 前后。\n```json\n{"ok": true, "list": [1, 2, 3,],}\n```\n结束。'
  );
  assert.strictEqual(tolerant.ok, true, '应从说明文字和代码块中提取 JSON');
  assert.deepStrictEqual(tolerant.list, [1, 2, 3], '应容忍数组末尾多余逗号');

  const body =
    '雾从码头漫上来，她把那截红绳收进掌心，听见塔下有第二个人在数台阶。'.repeat(4);
  const parsed = parseGeneratedCandidates(
    `以下是候选：\n\`\`\`json\n{"candidates":[
      {"title":"第十三阶","direction":"先发现物证","summary":"停在物证出现时","content":${JSON.stringify(body)}},
      {"title":"镜室暗处","direction":"从周砚视角切入","summary":"周砚先开口","content":${JSON.stringify(`${body}周砚没有开灯。`)}},
      {"title":"空稿","direction":"无效","summary":"应被过滤","content":""}
    ],}\n\`\`\``,
    { desiredLength: 1500 }
  );
  assert.strictEqual(parsed.length, 2, '应保留 2 个完整候选并过滤空稿');
  assert.strictEqual(parsed[0].title, '第十三阶', '应解析候选标题');
  assert.ok(parsed[0].charCount >= 80, '应统计候选正文字数');
  assert.throws(
    () =>
      parseGeneratedCandidates(
        JSON.stringify({ candidates: [{ title: '只有一个', content: body }] })
      ),
    (error) => error.code === 'LLM_BAD_JSON',
    '少于 2 个完整候选时应明确报 LLM_BAD_JSON'
  );

  const fixture = makeNovelFixture();
  const continuation = buildContinuationPrompt({
    ...fixture,
    requirements: '续写下一章，要求主角发现线索但不要揭露真相。',
    plotDirection: '让物证先出现，暂时不解释',
    targetLength: 1500,
    narrator: 'third-limited',
    strictSettings: true,
  });
  assert.strictEqual(continuation.candidateCount, 3, '常规长度应生成 3 个候选');
  assert.ok(
    continuation.user.includes('主角发现线索但不要揭露真相'),
    '续写提示词应包含作者要求'
  );
  assert.ok(continuation.user.includes('第三人称限知'), '续写提示词应包含叙事视角');
  assert.ok(
    continuation.user.includes('林澄的哥哥没有被确认死亡'),
    '续写提示词应包含作者纠正'
  );
  assert.ok(continuation.user.includes('【故事记忆卡】'), '续写提示词应包含故事记忆卡');
  assert.ok(continuation.user.includes('【最近章节原文】'), '续写提示词应包含最近章节');

  const longContinuation = buildContinuationPrompt({
    ...fixture,
    targetLength: 2000,
    narrator: 'third-limited',
    strictSettings: false,
  });
  assert.strictEqual(longContinuation.candidateCount, 2, '长稿应降到 2 个候选');
  assert.ok(
    longContinuation.user.includes('2 个方向明显不同'),
    '候选数量应同步写入提示词'
  );

  const manyChapters = Array.from({ length: 30 }, (_, index) => ({
    id: index + 1,
    order: index + 1,
    title: `第 ${index + 1} 章`,
    content: `【原文-${String(index + 1).padStart(2, '0')}】${'雾'.repeat(1800)}`,
  }));
  const bounded = buildContinuationPrompt({
    ...fixture,
    chapters: manyChapters,
    targetLength: 1200,
    narrator: 'third-limited',
  });
  assert.ok(bounded.user.includes('【原文-30】'), '续写上下文应包含最新章节');
  assert.ok(!bounded.user.includes('【原文-01】'), '续写上下文不应包含全部旧章节原文');
  assert.ok(bounded.user.length < 50000, '续写上下文应保持在预算内');

  const selected = selectChaptersForAnalysis(manyChapters);
  assert.strictEqual(selected.length, 30, '未超过抽样上限时应覆盖全部章节');
  const veryLong = manyChapters.concat(
    Array.from({ length: 30 }, (_, index) => ({
      id: index + 31,
      order: index + 31,
      title: `第 ${index + 31} 章`,
      content: `【原文-${String(index + 31).padStart(2, '0')}】${'潮'.repeat(1800)}`,
    }))
  );
  const sampled = selectChaptersForAnalysis(veryLong);
  assert.strictEqual(sampled.length, 36, '超长作品应抽样 36 章');
  assert.strictEqual(sampled[0].order, 1, '抽样必须保留开篇');
  assert.strictEqual(sampled[sampled.length - 1].order, 60, '抽样必须保留最新章节');
  assert.strictEqual(
    new Set(sampled.map((chapter) => chapter.order)).size,
    sampled.length,
    '抽样章节不能重复'
  );
  const biblePrompt = buildStoryBiblePrompt({
    novel: fixture.novel,
    chapters: veryLong,
    previousCore: fixture.bible.core,
  });
  assert.ok(biblePrompt.user.includes('全书共 60 章'), '超长作品应提示抽样覆盖范围');
  assert.ok(biblePrompt.user.includes('【原文-60】'), '记忆卡提示词应包含最新章节原文');
  assert.ok(biblePrompt.user.length < 90000, '记忆卡上下文应保持在预算内');

  const assistantChapters = Array.from({ length: 10 }, (_, index) => ({
    id: index + 1,
    order: index + 1,
    title: `第 ${index + 1} 章`,
    content: `【原文-${String(index + 1).padStart(2, '0')}】${'灯'.repeat(2000)}`,
  }));
  const assistant = buildNovelAssistantPrompt({
    ...fixture,
    chapters: assistantChapters,
    bible: {
      ...fixture.bible,
      core: normalizeStoryCore(
        {
          summary: fixture.bible.core.summary,
          characters: fixture.bible.core.characters,
          chapterSummaries: assistantChapters.map((chapter) => ({
            chapter: `第 ${chapter.order} 章`,
            title: chapter.title,
            summary: `第 ${chapter.order} 章摘要`,
          })),
        },
        { chapters: assistantChapters }
      ),
    },
    messages: [{ role: 'user', content: '当前还有哪些未回收伏笔？' }],
  });
  assert.ok(assistant.system.includes('【原文-10】'), '助手应读取最近章节原文');
  assert.ok(!assistant.system.includes('【原文-01】'), '助手不应读取全部旧章节原文');
  assert.ok(assistant.system.includes('更早章节摘要'), '助手应使用旧章节摘要控制上下文');
  assert.ok(
    assistant.system.includes('不要使用 Markdown 标题'),
    '助手提示词应要求纯文本回答'
  );
  assert.ok(assistant.system.length < 40000, '助手上下文应保持在预算内');

  const consistency = normalizeConsistency({
    overall: '有两处信息边界问题需要处理。',
    dimensionScores: {
      人物: 90,
      relationship: 80,
      timeline: 75,
      'world-rule': 60,
      伏笔: 55,
      文风: 88,
    },
    issues: [
      {
        dimension: '世界观',
        severity: '严重',
        location: '第 2 段第 1 句',
        excerpt: '浓雾里，他看见旧船厂的门牌。',
        problem: '当前设定说浓雾中看不到旧船厂。',
        evidence: '雾港的雾：灯塔光只能扫到近岸。',
        suggestion: '改成只看见一盏模糊的灯。',
      },
    ],
  });
  assert.strictEqual(consistency.dimensions.length, 6, '一致性应固定输出六个维度');
  assert.strictEqual(consistency.issues[0].dimension, 'worldRule', '应归一化维度别名');
  assert.strictEqual(consistency.issues[0].severity, 'high', '应归一化严重程度');
  assert.strictEqual(consistency.passed, false, '存在严重问题时应判定未通过');

  const appended = appendCorrection(fixture.bible.corrections, {
    type: 'unknown',
    target: '白塔',
    content: '  白塔只有一道铁门。  ',
  });
  assert.strictEqual(appended.corrections.notes.length, 2, '纠正应追加而非覆盖');
  assert.strictEqual(appended.note.type, 'other', '未知纠正类型应归入 other');
  assert.strictEqual(appended.note.content, '白塔只有一道铁门。', '纠正内容应去掉首尾空白');
  assert.ok(
    JSON.stringify(fixture.bible.core).includes('林澄的哥哥没有被确认死亡'),
    '追加纠正不应改写模型提取的核心统计'
  );

  console.log(
    '  ✓ 小说 JSON 容错 / 上下文预算 / 提示词 / 纠正追加 / 候选择优'
  );
}

async function checkNovelNoKey() {
  const fixture = makeNovelFixture();
  await expectNotConfigured('小说记忆卡分析', () =>
    analyzeStoryBible({ ...fixture, previousCore: null })
  );
  await expectNotConfigured('小说续写候选', () =>
    generateNovelCandidates({
      ...fixture,
      requirements: '续写下一章，主角发现线索但不揭露真相。',
      targetLength: 1200,
      narrator: 'third-limited',
      plotDirection: '',
      strictSettings: true,
    })
  );
  await expectNotConfigured('小说一致性检查', () =>
    checkNovelConsistency({
      ...fixture,
      draft: fixture.chapters[0].content,
      title: '线索',
    })
  );
  await expectNotConfigured('小说助手问答', () =>
    answerNovelQuestion({
      ...fixture,
      messages: [{ role: 'user', content: '当前还有哪些未回收伏笔？' }],
    })
  );
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

  console.log('\n== 小说功能无 API Key ==');
  await checkNovelNoKey();

  console.log('\n== 提示词与评分 ==');
  checkPrompts();
  checkNovelToleranceAndPrompts();
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
