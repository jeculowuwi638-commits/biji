<template>
  <section class="score-panel paper-card">
    <header class="score-header">
      <div class="score-ring" :style="ringStyle">
        <div class="ring-inner">
          <strong class="mono">{{ score.score }}</strong>
          <span>/ 100</span>
        </div>
      </div>

      <div class="score-copy">
        <div class="score-title-row">
          <h3>像不像你</h3>
          <span class="level-chip" :style="{ color: tone.color, background: tone.soft }">
            {{ score.level }}
          </span>
        </div>
        <p class="headline">{{ score.headline }}</p>
        <p class="score-note" v-if="!score.profileUsed">
          本次未使用笔迹档案，只检测通用 AI 味，不计算个人贴合度。
        </p>
        <p class="score-note" v-else>
          正在对照「{{ profileName || '所选档案' }}」的句长、语气、用词和表达习惯。
        </p>

        <div class="score-meters">
          <div class="meter">
            <div class="meter-head">
              <span>AI 味</span>
              <b class="mono">{{ score.aiFlavor }}</b>
            </div>
            <div class="meter-track">
              <span class="meter-fill ai" :style="{ width: `${score.aiFlavor}%` }" />
            </div>
            <span class="meter-hint">越低越自然</span>
          </div>

          <div class="meter" v-if="score.profileUsed">
            <div class="meter-head">
              <span>个人贴合</span>
              <b class="mono">{{ score.personalFit }}</b>
            </div>
            <div class="meter-track">
              <span class="meter-fill fit" :style="{ width: `${score.personalFit}%` }" />
            </div>
            <span class="meter-hint">越高越像你</span>
          </div>
        </div>
      </div>
    </header>

    <div class="score-body">
      <div class="issues-column">
        <div class="block-head">
          <h4>
            逐句诊断
            <span class="count mono">{{ score.issues?.length || 0 }}</span>
          </h4>
          <span class="legend">
            <i class="dot high" />明显
            <i class="dot medium" />注意
            <i class="dot low" />轻微
          </span>
        </div>

        <div v-if="!score.issues?.length" class="clean-state">
          <el-icon><CircleCheck /></el-icon>
          <p>没有发现明显问题。这篇文章的语感和你的档案相当接近。</p>
        </div>

        <div v-else class="issue-list">
          <article
            v-for="(issue, index) in score.issues"
            :key="issue.id"
            class="issue-card"
            :class="issue.severity"
            :data-issue="issue.id"
          >
            <div class="issue-top">
              <span class="severity" :style="{ color: metaOf(issue).color }">
                <i class="dot" :class="issue.severity" />
                {{ metaOf(issue).label }}
              </span>
              <span class="issue-location mono">
                {{ issue.paragraph ? `第 ${issue.paragraph} 段` : '整体' }}
              </span>
              <span class="issue-no mono">{{ String(index + 1).padStart(2, '0') }}</span>
            </div>
            <p v-if="issue.sentence" class="issue-sentence">“{{ issue.sentence }}”</p>
            <p class="issue-reason">{{ issue.reason }}</p>
            <p class="issue-suggestion">
              <el-icon><ArrowRight /></el-icon>
              {{ issue.suggestion }}
            </p>
          </article>
        </div>
      </div>

      <aside class="score-aside">
        <div class="aside-block">
          <span class="section-kicker">What works</span>
          <h4>这些地方像你</h4>
          <ul v-if="score.highlights?.length" class="highlight-list">
            <li v-for="item in score.highlights" :key="item">
              <el-icon><Check /></el-icon>
              {{ item }}
            </li>
          </ul>
          <p v-else class="muted small">还没有捕捉到稳定的亮点。</p>
        </div>

        <div class="aside-block metrics-block">
          <span class="section-kicker">At a glance</span>
          <div class="quick-metrics">
            <div>
              <strong class="mono">{{ score.stats?.charCount || 0 }}</strong>
              <span>字数</span>
            </div>
            <div>
              <strong class="mono">{{ score.stats?.avgSentenceLength || 0 }}</strong>
              <span>平均句长</span>
            </div>
            <div>
              <strong class="mono">{{ score.stats?.formality || 0 }}%</strong>
              <span>正式度</span>
            </div>
            <div>
              <strong class="mono">{{ score.stats?.clicheHits || 0 }}</strong>
              <span>套话命中</span>
            </div>
          </div>
        </div>

      </aside>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { scoreTone, severityMeta } from '../utils/format';

const props = defineProps({
  score: { type: Object, required: true },
  profileName: { type: String, default: '' },
});

const tone = computed(() => scoreTone(props.score.score));
const ringStyle = computed(() => ({
  background: `conic-gradient(${tone.value.color} ${Math.min(100, Math.max(0, props.score.score)) * 3.6}deg, rgba(28, 27, 24, 0.08) 0deg)`,
}));

function metaOf(issue) {
  return severityMeta(issue.severity);
}
</script>

<style scoped>
.score-panel {
  padding: 30px 30px 28px;
  animation: rise 0.45s cubic-bezier(0.22, 0.8, 0.3, 1) both;
}

.score-header {
  display: flex;
  gap: 28px;
  padding-bottom: 26px;
  border-bottom: 1px solid var(--line);
}

.score-ring {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 132px;
  height: 132px;
  border-radius: 50%;
  padding: 7px;
}

.ring-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: var(--paper-bright);
  box-shadow: inset 0 0 0 1px var(--line);
}

.ring-inner strong {
  font-family: var(--font-serif);
  font-size: 42px;
  font-weight: 600;
  line-height: 1;
}

.ring-inner span {
  margin-top: 5px;
  color: var(--muted-soft);
  font-size: 10px;
}

.score-copy {
  flex: 1;
  min-width: 0;
}

.score-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.score-title-row h3 {
  font-size: 23px;
  letter-spacing: -0.02em;
}

.level-chip {
  padding: 3px 9px;
  border-radius: 3px;
  font-size: 10.5px;
  font-weight: 600;
}

.headline {
  margin-top: 10px;
  color: var(--ink-soft);
  font-family: var(--font-serif);
  font-size: 15px;
  line-height: 1.75;
}

.score-note {
  margin-top: 6px;
  color: var(--muted-soft);
  font-size: 10.5px;
}

.score-meters {
  display: flex;
  gap: 30px;
  margin-top: 20px;
}

.meter {
  flex: 1;
  max-width: 260px;
}

.meter-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  color: var(--muted);
  font-size: 10.5px;
}

.meter-head b {
  color: var(--ink-soft);
  font-size: 13px;
}

.meter-track {
  height: 4px;
  margin-top: 6px;
  overflow: hidden;
  border-radius: 4px;
  background: rgba(28, 27, 24, 0.08);
}

.meter-fill {
  display: block;
  height: 100%;
  border-radius: 4px;
  transition: width 0.6s cubic-bezier(0.22, 0.8, 0.3, 1);
}

.meter-fill.ai {
  background: var(--vermilion);
}

.meter-fill.fit {
  background: var(--jade);
}

.meter-hint {
  display: block;
  margin-top: 5px;
  color: var(--muted-soft);
  font-size: 9px;
}

.score-body {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(260px, 0.8fr);
  gap: 34px;
  padding-top: 26px;
}

.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.block-head h4 {
  font-size: 16px;
}

.count {
  margin-left: 6px;
  color: var(--vermilion);
  font-size: 13px;
}

.legend {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--muted-soft);
  font-size: 9.5px;
}

.dot {
  display: inline-block;
  width: 5px;
  height: 5px;
  margin-right: 4px;
  border-radius: 50%;
}

.dot.high {
  background: var(--vermilion);
}

.dot.medium {
  background: var(--gold);
}

.dot.low {
  background: var(--muted-soft);
}

.issue-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.issue-card {
  padding: 13px 15px;
  border: 1px solid var(--line);
  border-left-width: 2px;
  border-radius: 5px;
  background: rgba(255, 253, 248, 0.48);
}

.issue-card.high {
  border-left-color: var(--vermilion);
}

.issue-card.medium {
  border-left-color: var(--gold);
}

.issue-card.low {
  border-left-color: var(--muted-soft);
}

.issue-top {
  display: flex;
  align-items: center;
  gap: 10px;
}

.severity {
  display: inline-flex;
  align-items: center;
  font-size: 9.5px;
  font-weight: 600;
}

.issue-location {
  color: var(--muted-soft);
  font-size: 9.5px;
}

.issue-no {
  margin-left: auto;
  color: var(--muted-soft);
  font-size: 9px;
}

.issue-sentence {
  margin-top: 8px;
  color: var(--ink-soft);
  font-family: var(--font-serif);
  font-size: 12.5px;
  line-height: 1.7;
}

.issue-reason {
  margin-top: 5px;
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.7;
}

.issue-suggestion {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  margin-top: 6px;
  color: var(--jade);
  font-size: 11px;
  line-height: 1.7;
}

.issue-suggestion .el-icon {
  margin-top: 3px;
  flex: none;
  font-size: 10px;
}

.clean-state {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 22px;
  border: 1px dashed var(--line-strong);
  border-radius: 6px;
  color: var(--jade);
}

.clean-state .el-icon {
  font-size: 20px;
  flex: none;
}

.clean-state p {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.7;
}

.score-aside {
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding-left: 30px;
  border-left: 1px solid var(--line);
}

.aside-block h4 {
  margin-top: 6px;
  font-size: 14px;
}

.highlight-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.highlight-list li {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.65;
}

.highlight-list .el-icon {
  margin-top: 4px;
  flex: none;
  color: var(--jade);
  font-size: 10px;
}

.quick-metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 12px;
}

.quick-metrics strong {
  display: block;
  color: var(--ink-soft);
  font-family: var(--font-serif);
  font-size: 18px;
  font-weight: 600;
}

.quick-metrics span {
  display: block;
  margin-top: 2px;
  color: var(--muted-soft);
  font-size: 9.5px;
}

.small {
  font-size: 11px;
}

@media (max-width: 980px) {
  .score-body {
    grid-template-columns: 1fr;
  }

  .score-aside {
    padding-top: 22px;
    padding-left: 0;
    border-top: 1px solid var(--line);
    border-left: none;
  }
}

@media (max-width: 620px) {
  .score-panel {
    padding: 22px 18px;
  }

  .score-header {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .score-title-row {
    justify-content: center;
  }

  .score-meters {
    flex-direction: column;
    gap: 14px;
  }

  .meter {
    max-width: none;
  }
}
</style>
