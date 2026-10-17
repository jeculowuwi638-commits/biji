const path = require('node:path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
// 冒烟测试只读缓存，强制禁用真实模型调用。
process.env.LLM_API_KEY = '';

const assert = require('node:assert');
const llm = require('../src/services/llm');
const { buildSemanticPrompt } = require('../src/services/style');
const { buildGeneratePrompt } = require('../src/services/generate');
const { buildRewritePrompt } = require('../src/services/rewrite');
const { scoreContent } = require('../src/services/score');
const {
  DEMO_WRITING,
  OPINION_ARTICLES,
  WORK_PROFILE,
  LIFE_PROFILE,
} = require('../src/demo/demoData');
const responses = require('../src/demo/demoResponses');

const failures = [];

async function checkCache(label, prompt) {
  try {
    const result = await llm.chat(prompt);
    assert.strictEqual(result.cached, true, `${label} 应该命中缓存`);
    console.log(`  ✓ ${label.padEnd(28)} ${String(result.content.length).padStart(5)} 字`);
    return result.content;
  } catch (error) {
    failures.push(`${label}: ${error.message}`);
    console.log(`  ✗ ${label.padEnd(28)} ${error.message}`);
    return null;
  }
}

function reportScore(label, content, profile) {
  const score = scoreContent({ content, profile, platform: 'wechat' });
  const again = scoreContent({ content, profile, platform: 'wechat' });
  assert.deepStrictEqual(
    { score: score.score, issues: score.issues, stats: score.stats },
    { score: again.score, issues: again.issues, stats: again.stats },
    `${label} 的评分应当可复现`
  );
  console.log(
    `  · ${label.padEnd(16)} 分数 ${String(score.score).padStart(3)} / ${score.level} · AI 味 ${score.aiFlavor} · 个人贴合 ${score.personalFit ?? '-'} · 问题 ${score.issues.length}`
  );
  return score;
}

async function main() {
  console.log('\n== 预置缓存检查 ==');
  await checkCache('档案分析：观点评论', buildSemanticPrompt(OPINION_ARTICLES));

  const combos = [
    ['wechat', null, 'none', responses.wechatNone],
    ['wechat', WORK_PROFILE, 'work', responses.wechatWork],
    ['wechat', LIFE_PROFILE, 'life', responses.wechatLife],
    ['xiaohongshu', null, 'none', responses.xiaohongshuNone],
    ['xiaohongshu', WORK_PROFILE, 'work', responses.xiaohongshuWork],
    ['xiaohongshu', LIFE_PROFILE, 'life', responses.xiaohongshuLife],
    ['douyin', null, 'none', responses.douyinNone],
    ['douyin', WORK_PROFILE, 'work', responses.douyinWork],
    ['douyin', LIFE_PROFILE, 'life', responses.douyinLife],
  ];

  for (const [platform, profile, suffix, expected] of combos) {
    const content = await checkCache(
      `生成：${platform}/${suffix}`,
      buildGeneratePrompt({
        topic: DEMO_WRITING.topic,
        platform,
        profile,
        tuningEnabled: false,
        tuning: null,
      })
    );
    if (content) {
      assert.strictEqual(content, expected.trim(), `${platform}/${suffix} 缓存内容应与演示文案一致`);
    }
  }

  await checkCache(
    '生成：wechat/life/微调',
    buildGeneratePrompt({
      topic: DEMO_WRITING.topic,
      platform: 'wechat',
      profile: LIFE_PROFILE,
      tuningEnabled: true,
      tuning: DEMO_WRITING.tuning,
    })
  );

  console.log('\n== 检测器检查 ==');
  reportScore('公众号/无档案', responses.wechatNone, null);
  reportScore('公众号/工作风格', responses.wechatWork, WORK_PROFILE);
  const lifeScore = reportScore('公众号/随笔生活', responses.wechatLife, LIFE_PROFILE);
  reportScore('小红书/随笔生活', responses.xiaohongshuLife, LIFE_PROFILE);

  assert.ok(lifeScore.issues.length >= 2, '随笔生活版本应至少检测出两个具体问题');
  assert.ok(
    lifeScore.issues.some(
      (issue) => issue.sentence && issue.reason.includes('比你的平均句长')
    ),
    '应定位到具体的长句'
  );
  assert.ok(
    lifeScore.issues.some((issue) => issue.reason.includes('值得注意的是')),
    '应命中“值得注意的是”套话'
  );

  const noProfileScore = scoreContent({
    content: responses.wechatNone,
    profile: null,
    platform: 'wechat',
  });
  const workScore = scoreContent({
    content: responses.wechatWork,
    profile: WORK_PROFILE,
    platform: 'wechat',
  });
  assert.ok(
    noProfileScore.score < workScore.score,
    '无档案的通用 AI 文本分数应低于贴合档案的文本'
  );

  console.log('\n== 重写缓存检查 ==');
  const rewritePrompt = buildRewritePrompt({
    content: responses.wechatLife,
    problems: lifeScore.issues,
    profile: LIFE_PROFILE,
    platform: 'wechat',
    topic: DEMO_WRITING.topic,
  });
  const rewritten = await checkCache('重写：wechat/life', rewritePrompt);
  let rewrittenScore = null;
  if (rewritten) {
    assert.ok(!rewritten.includes('值得注意的是'), '重写结果应去掉套话');
    const rewrittenChars = rewritten.replace(/\s/g, '').length;
    assert.ok(
      rewrittenChars >= 800 && rewrittenChars <= 1500,
      `第一轮重写应保持在公众号篇幅内（当前 ${rewrittenChars} 字）`
    );
    rewrittenScore = reportScore('重写后', rewritten, LIFE_PROFILE);
    assert.ok(
      rewrittenScore.score >= lifeScore.score,
      `重写后的分数应不低于原文（${rewrittenScore.score} vs ${lifeScore.score}）`
    );
  }

  if (rewritten && rewrittenScore) {
    const secondPrompt = buildRewritePrompt({
      content: rewritten,
      problems: rewrittenScore.issues,
      profile: LIFE_PROFILE,
      platform: 'wechat',
      topic: DEMO_WRITING.topic,
    });
    const rewrittenAgain = await checkCache('重写：wechat/life/第2轮', secondPrompt);
    if (rewrittenAgain) {
      const finalChars = rewrittenAgain.replace(/\s/g, '').length;
      assert.ok(
        finalChars >= 800 && finalChars <= 1500,
        `第二轮重写应保持在公众号篇幅内（当前 ${finalChars} 字）`
      );
      const finalScore = reportScore('第2轮重写后', rewrittenAgain, LIFE_PROFILE);
      assert.strictEqual(finalScore.issues.length, 0, '第二轮重写后应没有剩余问题');
      assert.ok(
        finalScore.score >= rewrittenScore.score,
        `第二轮重写的分数应不低于第一轮（${finalScore.score} vs ${rewrittenScore.score}）`
      );
    }
  }

  console.log('\n== 演示文案字数 ==');
  for (const [name, text, min, max] of [
    ['公众号/无档案', responses.wechatNone, 800, 1500],
    ['公众号/工作风格', responses.wechatWork, 800, 1500],
    ['公众号/随笔生活', responses.wechatLife, 800, 1500],
    ['公众号/微调', responses.wechatLifeTuned, 800, 1500],
    ['小红书/无档案', responses.xiaohongshuNone, 300, 500],
    ['小红书/工作风格', responses.xiaohongshuWork, 300, 500],
    ['小红书/随笔生活', responses.xiaohongshuLife, 300, 500],
    ['抖音/无档案', responses.douyinNone, 350, 600],
    ['抖音/工作风格', responses.douyinWork, 350, 600],
    ['抖音/随笔生活', responses.douyinLife, 350, 600],
  ]) {
    const count = text.replace(/\s/g, '').length;
    const flag = count < min || count > max ? '⚠' : '✓';
    console.log(`  ${flag} ${name.padEnd(16)} ${String(count).padStart(4)} 字（目标 ${min}–${max}）`);
  }

  const cache = llm.getCacheStatus();
  console.log(`\n缓存条目：${cache.entries}，路径：${cache.path}`);

  if (failures.length) {
    console.error(`\n失败 ${failures.length} 项：`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('\n全流程离线演示检查通过。');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
