const {
  clamp,
  countPattern,
  countWords,
  quickMetrics,
  splitSentences,
} = require('./style');

const CLICHES = [
  {
    pattern: /综上所述/g,
    label: '综上所述',
    severity: 'high',
    suggestion: '删掉总结式收尾，落回一个具体场景、动作或判断。',
  },
  {
    pattern: /总而言之/g,
    label: '总而言之',
    severity: 'high',
    suggestion: '不要给全文下总结，换成一个具体的人或画面收尾。',
  },
  {
    pattern: /总的来说/g,
    label: '总的来说',
    severity: 'medium',
    suggestion: '直接说结论，或者用一个例子代替概括。',
  },
  {
    pattern: /值得注意的是/g,
    label: '值得注意的是',
    severity: 'high',
    suggestion: '删掉提示语，直接写那件事本身。',
  },
  {
    pattern: /值得一提的是/g,
    label: '值得一提的是',
    severity: 'medium',
    suggestion: '删掉提示语，把这件事放进叙述里。',
  },
  {
    pattern: /在当今社会/g,
    label: '在当今社会',
    severity: 'high',
    suggestion: '从你眼前的具体场景开始写，不要从时代背景起手。',
  },
  {
    pattern: /在这个快节奏的时代/g,
    label: '在这个快节奏的时代',
    severity: 'high',
    suggestion: '删掉时代背景，直接进入你的具体经历。',
  },
  {
    pattern: /随着[^，。；\n]{2,18}(?:的)?(?:发展|进步|普及)/g,
    label: '随着……的发展',
    severity: 'medium',
    suggestion: '直接写发生了什么变化，不要用“随着”铺背景。',
  },
  {
    pattern: /不可否认/g,
    label: '不可否认',
    severity: 'medium',
    suggestion: '这个让步句可以删掉，直接说你的判断。',
  },
  {
    pattern: /毋庸置疑/g,
    label: '毋庸置疑',
    severity: 'high',
    suggestion: '删掉强调词，让事实自己说话。',
  },
  {
    pattern: /众所周知/g,
    label: '众所周知',
    severity: 'high',
    suggestion: '不要替读者预设共识，直接给出你的观察。',
  },
  {
    pattern: /显而易见/g,
    label: '显而易见',
    severity: 'medium',
    suggestion: '删掉评价，直接写你看到的东西。',
  },
  {
    pattern: /让我们(?:一起|共同)/g,
    label: '让我们一起',
    severity: 'high',
    suggestion: '不要号召读者，回到你自己的具体经验。',
  },
  {
    pattern: /不仅[^。！？\n]{1,35}而且/g,
    label: '不仅……而且',
    severity: 'medium',
    suggestion: '拆成两句具体的话，不要用递进模板。',
  },
  {
    pattern: /(?:赋能|抓手|闭环|底层逻辑|护城河|颗粒度|组合拳)/g,
    label: '互联网黑话',
    severity: 'low',
    suggestion: '换成日常说法，别用行业黑话替代具体意思。',
  },
];

const TRANSITION_WORDS = ['然而', '此外', '因此', '同时', '总之', '换言之', '也就是说', '由此可见'];

const OPINION_MARKERS = ['我觉得', '我认为', '我的看法', '说到底', '其实', '对我来说', '我更', '我不'];

function severityRank(severity) {
  if (severity === 'high') return 0;
  if (severity === 'medium') return 1;
  return 2;
}

function truncate(text, max = 120) {
  const value = String(text || '').trim();
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function addIssue(issues, issue) {
  if (issues.length >= 20) return;
  issues.push({
    id: `issue-${issues.length + 1}`,
    severity: issue.severity || 'medium',
    type: issue.type || 'ai-flavor',
    paragraph: issue.paragraph ?? null,
    sentence: issue.sentence ? truncate(issue.sentence) : null,
    reason: issue.reason,
    suggestion: issue.suggestion || '按这个方向改一改。',
  });
}

function deviationSeverity(diff, medium, high) {
  if (diff >= high) return 'high';
  if (diff >= medium) return 'medium';
  return null;
}

/**
 * 双维度检测：
 * 1. 通用 AI 味（规则层，无需模型）
 * 2. 个人偏离度（只在选择档案时可用）
 */
function scoreContent({ content, profile, platform }) {
  const text = String(content || '').trim();
  const sentences = splitSentences(text);
  const metrics = quickMetrics(text);
  const issues = [];
  const highlights = [];

  const clicheHits = [];
  let sentenceLevelDeviations = 0;

  for (const sentence of sentences) {
    for (const cliche of CLICHES) {
      const matches = sentence.text.match(cliche.pattern);
      if (!matches || !matches.length) continue;
      const key = `${sentence.index}-${cliche.label}`;
      if (clicheHits.some((item) => item.key === key)) continue;
      clicheHits.push({ key, severity: cliche.severity });

      const extra = matches.length > 1 ? `（这篇里出现了 ${matches.length} 次）` : '';
      addIssue(issues, {
        severity: cliche.severity,
        type: 'ai-flavor',
        paragraph: sentence.paragraphIndex + 1,
        sentence: sentence.text,
        reason: `“${cliche.label}”是典型的 AI 套话${extra}，你平时很少这样起句。`,
        suggestion: cliche.suggestion,
      });
    }

    // 有档案时，逐句比对句长基线，指出具体哪一句不像你。
    if (profile && profile.stats) {
      const baseline = Number(profile.stats.avgSentenceLength) || 20;
      const threshold = Math.max(baseline * 1.65, baseline + 14);
      if (sentence.length >= threshold) {
        sentenceLevelDeviations += 1;
        const diff = Math.round(sentence.length - baseline);
        addIssue(issues, {
          severity: sentence.length >= baseline + 24 ? 'high' : 'medium',
          type: 'deviation',
          paragraph: sentence.paragraphIndex + 1,
          sentence: sentence.text,
          reason: `这句话有 ${sentence.length} 字，比你的平均句长 ${baseline} 字长了 ${diff} 字，读起来不像你的节奏。`,
          suggestion: '拆成两到三句短句，或者删掉中间的修饰，把动作和判断分开。',
        });
      }
    }
  }

  const transitionCount = countWords(text, TRANSITION_WORDS);
  const transitionDensity = (transitionCount / Math.max(1, metrics.charCount)) * 1000;

  const first = sentences[0]?.text || '';
  const hasTemplateOpening = /^(在这个|随着|当今|近年来|在当今)/.test(first);

  const parallelPattern =
    /首先[\s\S]{0,220}其次[\s\S]{0,220}(?:最后|最终)|(?:不仅|不但)[^。！？\n]{1,40}(?:而且|还)/;
  const hasParallelism = parallelPattern.test(text);

  const longSentenceThreshold = 46;
  const longSentenceCount = sentences.filter((sentence) => sentence.length > longSentenceThreshold).length;
  const longSentenceRatio = sentences.length ? longSentenceCount / sentences.length : 0;

  const numberMatches = countPattern(text, /\d+(?:\.\d+)?/g);
  const unitMatches = countPattern(
    text,
    /(?:块钱|小时|分钟|天|年|月|岁|次|个人|件|家|公里|米|杯|碗|份|场|周|点|分|秒|页|步|条|句)/g
  );
  const quoteMarks = countPattern(text, /[“”"]/g);
  const concreteSignals = numberMatches + unitMatches + Math.floor(quoteMarks / 2);

  // ---- 通用 AI 味 ----
  let aiRisk = 0;
  for (const hit of clicheHits) {
    if (hit.severity === 'high') aiRisk += 14;
    else if (hit.severity === 'medium') aiRisk += 8;
    else aiRisk += 3;
  }
  aiRisk = Math.min(38, aiRisk);

  if (hasTemplateOpening) aiRisk += 5;

  if (metrics.sentenceCount >= 6 && metrics.sentenceLengthVariation < 0.22) {
    aiRisk += 12;
    addIssue(issues, {
      severity: 'medium',
      type: 'ai-flavor',
      reason: `句长标准差只有 ${metrics.sentenceLengthStd}，句子长度过于均匀，缺少长短句的呼吸感。`,
      suggestion: '把其中两三句拆短，下一句再放长，让节奏有起伏。',
    });
  }

  if (metrics.charCount >= 220 && concreteSignals / Math.max(1, metrics.charCount / 1000) < 4.5) {
    aiRisk += 12;
    addIssue(issues, {
      severity: 'medium',
      type: 'ai-flavor',
      reason: '全文几乎没有具体数字、时间或场景，读起来像概括，不像亲身经历。',
      suggestion: '补 1–2 个具体的时间、地点、动作或数字，不必多，但要能落到地上。',
    });
  }

  if (transitionCount >= 3 && transitionDensity >= 2.5) {
    aiRisk += 9;
    addIssue(issues, {
      severity: 'medium',
      type: 'ai-flavor',
      reason: `“然而、此外、因此”这类过渡词出现了 ${transitionCount} 次，逻辑像被连接词推着走。`,
      suggestion: '删掉一半过渡词，让前后句靠内容自己衔接。',
    });
  }

  if (hasParallelism) {
    aiRisk += 9;
    addIssue(issues, {
      severity: 'medium',
      type: 'ai-flavor',
      reason: '出现了“首先—其次—最后”或“不仅—而且”的模板化递进结构。',
      suggestion: '打散这个结构，只保留最重要的一层，其余用具体事实带过。',
    });
  }

  if (longSentenceRatio > 0.22) {
    aiRisk += 8;
    addIssue(issues, {
      severity: 'medium',
      type: 'ai-flavor',
      reason: `有 ${Math.round(longSentenceRatio * 100)}% 的句子超过 ${longSentenceThreshold} 字，读起来容易喘不过气。`,
      suggestion: '挑最长的两三句拆开，短句更适合表达具体的动作和情绪。',
    });
  }

  const aiFlavor = Math.round(clamp(aiRisk, 0, 100));

  // ---- 个人偏离度 ----
  let personalFit = null;
  let profileStats = null;

  if (profile && profile.stats) {
    profileStats = profile.stats;
    let fitRisk = 0;

    const baseline = Number(profileStats.avgSentenceLength) || 20;
    const avgDiff = Math.abs(metrics.avgSentenceLength - baseline);
    if (avgDiff > 15) fitRisk += 20;
    else if (avgDiff > 8) fitRisk += 10;

    if (avgDiff > 8) {
      addIssue(issues, {
        severity: avgDiff > 15 ? 'high' : 'medium',
        type: 'deviation',
        reason: `你的平均句长是 ${baseline} 字，这篇是 ${metrics.avgSentenceLength} 字，整体节奏偏了。`,
        suggestion:
          metrics.avgSentenceLength > baseline
            ? '多拆短句，把一句话里的信息分两次说。'
            : '适当合并短句，让一个句子承载完整动作或判断。',
      });
    }

    const baseShort = Number(profileStats.shortSentenceRatio) || 30;
    const shortDiff = Math.abs(metrics.shortSentenceRatio - baseShort);
    if (shortDiff > 25) fitRisk += 12;
    else if (shortDiff > 15) fitRisk += 6;
    if (shortDiff > 15) {
      addIssue(issues, {
        severity: shortDiff > 25 ? 'high' : 'medium',
        type: 'deviation',
        reason: `你平时短句占 ${baseShort}%，这篇是 ${metrics.shortSentenceRatio}%，长短句比例不像你。`,
        suggestion: metrics.shortSentenceRatio > baseShort ? '把几句短句连起来，写成完整的一段叙述。' : '多切几刀，把长句拆成短句。',
      });
    }

    const baseFormality = Number(profileStats.formality) || 50;
    const formalityDiff = Math.abs(metrics.formality - baseFormality);
    if (formalityDiff > 38) fitRisk += 12;
    else if (formalityDiff > 28) fitRisk += 6;
    if (formalityDiff > 28) {
      addIssue(issues, {
        severity: formalityDiff > 38 ? 'high' : 'medium',
        type: 'deviation',
        reason: `这篇的正式度是 ${metrics.formality}%，你的档案是 ${baseFormality}%，语气偏差明显。`,
        suggestion: metrics.formality > baseFormality ? '松开一点，用你平时会说的词，不要端着。' : '收一点口语，把话说完整。',
      });
    }

    const baseTone = Number(profileStats.tone) || 50;
    const toneDiff = Math.abs(metrics.tone - baseTone);
    if (toneDiff > 30) fitRisk += 10;
    else if (toneDiff > 20) fitRisk += 5;

    const baseEmotion = Number(profileStats.emotion) || 50;
    const emotionDiff = Math.abs(metrics.emotion - baseEmotion);
    if (emotionDiff > 30) fitRisk += 10;
    else if (emotionDiff > 20) fitRisk += 5;
    if (emotionDiff > 30) {
      addIssue(issues, {
        severity: 'medium',
        type: 'deviation',
        reason: `这篇的感性度是 ${metrics.emotion}，你的档案是 ${baseEmotion}，情绪浓度不像你。`,
        suggestion: metrics.emotion > baseEmotion ? '把情绪收一点，多用事实和动作说话。' : '允许自己多写一点真实感受，不必一直克制。',
      });
    }

    const baseRhetorical = Number(profileStats.rhetoricalQuestionRate) || 0;
    const rhetoricalDiff = Math.abs(metrics.rhetoricalQuestionRate - baseRhetorical);
    if (rhetoricalDiff > 18) {
      fitRisk += 6;
      addIssue(issues, {
        severity: 'low',
        type: 'deviation',
        reason: `你平时反问句占 ${baseRhetorical}%，这篇是 ${metrics.rhetoricalQuestionRate}%，自问自答的习惯没出来。`,
        suggestion: '把其中一句判断改成问句，像你平时那样先问自己一句。',
      });
    }

    const baseMetaphor = Number(profileStats.metaphorDensity) || 0;
    const metaphorDiff = Math.abs(metrics.metaphorDensity - baseMetaphor);
    if (metaphorDiff > 18) {
      fitRisk += 5;
      addIssue(issues, {
        severity: 'low',
        type: 'deviation',
        reason: `你平时比喻密度约 ${baseMetaphor}%，这篇是 ${metrics.metaphorDensity}%。`,
        suggestion: metrics.metaphorDensity < baseMetaphor ? '可以加一个来自日常生活的比喻，不要用宏大意象。' : '比喻稍微收一点，别让意象盖过事情本身。',
      });
    }

    const basePersonal = Number(profileStats.personalExperienceRatio) || 0;
    // 只在“个人经历明显偏少”时扣分。个人经历比档案更多，不代表不像作者，
    // 更可能是这次的主题本身更需要第一人称。
    if (metrics.personalExperienceRatio < basePersonal - 25) {
      fitRisk += 8;
      addIssue(issues, {
        severity: 'medium',
        type: 'deviation',
        reason: `你平时有 ${basePersonal}% 的句子带个人经历，这篇只有 ${metrics.personalExperienceRatio}%，自己的痕迹偏少。`,
        suggestion: '补一个你亲身经历的小场景，哪怕只有两句话。',
      });
    }

    const catchphrases = Array.isArray(profile.semantic?.catchphrases)
      ? profile.semantic.catchphrases.filter(Boolean)
      : [];
    const catchphraseHits = catchphrases.filter((phrase) => text.includes(phrase));
    if (catchphrases.length && catchphraseHits.length === 0) {
      fitRisk += 8;
      addIssue(issues, {
        severity: 'medium',
        type: 'deviation',
        reason: `你常用的口头禅「${catchphrases.slice(0, 3).join('、')}」一个都没出现。`,
        suggestion: `自然地带出其中一个，比如「${catchphrases[0]}」，不要硬塞。`,
      });
    }

    const highWords = Array.isArray(profileStats.highFrequencyWords)
      ? profileStats.highFrequencyWords.map((item) => item.word).filter(Boolean)
      : [];
    const highWordHits = highWords.filter((word) => text.includes(word));
    if (highWords.length && highWordHits.length === 0) {
      // 高频词高度依赖主题，只作为弱信号，避免“写别的话题”被误判。
      fitRisk += 5;
      addIssue(issues, {
        severity: 'low',
        type: 'deviation',
        reason: `档案里的高频词（${highWords.slice(0, 4).join('、')}）一个都没出现。`,
        suggestion: '不用刻意堆词，但如果有一个词能自然放进来，会让语气更像你。',
      });
    }

    const viewpointStrength = Number(profile.semantic?.viewpointStrength) || 0;
    const hasOpinion = OPINION_MARKERS.some((marker) => text.includes(marker));
    if (viewpointStrength >= 65 && !hasOpinion) {
      fitRisk += 5;
      addIssue(issues, {
        severity: 'low',
        type: 'deviation',
        reason: `你的档案观点强度是 ${viewpointStrength}/100，但这篇几乎没有明确判断。`,
        suggestion: '在一处直接说出你的看法，不要只描述现象。',
      });
    }

    if (sentenceLevelDeviations > 0) {
      fitRisk += Math.min(16, sentenceLevelDeviations * 8);
    }

    personalFit = Math.round(clamp(100 - fitRisk, 0, 100));

    // 亮点使用与档案的对比结果。
    if (catchphraseHits.length) {
      highlights.push(`自然带出了「${catchphraseHits.slice(0, 2).join('、')}」等口头禅`);
    }
    if (highWordHits.length >= 3) {
      highlights.push(`用到了 ${highWordHits.length} 个你常写的词`);
    }
    if (avgDiff <= 4) {
      highlights.push(`句长与你平时的 ${baseline} 字很接近`);
    }
    if (formalityDiff <= 10) {
      highlights.push('正式度与档案基本一致');
    }
  }

  if (!clicheHits.length) highlights.push('没有命中常见 AI 套话');
  if (metrics.sentenceLengthVariation >= 0.3) highlights.push('句长有呼吸感，长短句交替自然');
  if (concreteSignals >= 5) highlights.push('有具体的时间、数字或场景细节');

  const highCount = issues.filter((issue) => issue.severity === 'high').length;
  const mediumCount = issues.filter((issue) => issue.severity === 'medium').length;

  let score;
  if (personalFit !== null) {
    score =
      personalFit * 0.55 +
      (100 - aiFlavor) * 0.45 -
      highCount * 3 -
      mediumCount * 1.5;
  } else {
    score = 100 - aiFlavor - highCount * 2 - mediumCount;
  }
  score = Math.round(clamp(score, 0, 100));

  let level;
  if (personalFit !== null) {
    if (score >= 85) level = '很像你';
    else if (score >= 70) level = '有几分像';
    else if (score >= 55) level = '还差一点';
    else level = '不太像你';
  } else {
    if (score >= 80) level = '自然';
    else if (score >= 65) level = '尚可';
    else level = 'AI 味偏重';
  }

  const sortedIssues = issues
    .sort((a, b) => {
      const severityDiff = severityRank(a.severity) - severityRank(b.severity);
      if (severityDiff !== 0) return severityDiff;
      const aHasSentence = a.sentence ? 0 : 1;
      const bHasSentence = b.sentence ? 0 : 1;
      return aHasSentence - bHasSentence;
    })
    .slice(0, 12)
    .map((issue, index) => ({ ...issue, id: `issue-${index + 1}` }));

  let headline;
  if (!sortedIssues.length) {
    headline =
      personalFit !== null
        ? '这篇的句式和语气都很贴你的档案，几乎找不到明显的偏离。'
        : '没有命中明显的 AI 套话，整体读起来比较自然。';
  } else {
    const sentenceIssue = sortedIssues.find((issue) => issue.sentence);
    if (sentenceIssue) {
      headline = `有 ${sortedIssues.length} 处值得改，最明显的是第 ${sentenceIssue.paragraph} 段那句。`;
    } else {
      headline = `有 ${sortedIssues.length} 处值得改，主要集中在整体节奏和用词上。`;
    }
  }

  return {
    score,
    level,
    headline,
    aiFlavor,
    personalFit,
    profileUsed: Boolean(profile),
    platform: platform || null,
    issues: sortedIssues,
    highlights: [...new Set(highlights)].slice(0, 4),
    stats: {
      charCount: metrics.charCount,
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
      personalExperienceRatio: metrics.personalExperienceRatio,
      clicheHits: clicheHits.length,
      transitionCount,
      concreteSignals,
    },
  };
}

module.exports = { scoreContent, CLICHES };
