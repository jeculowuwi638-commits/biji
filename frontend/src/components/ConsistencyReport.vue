<template>
  <section class="consistency-report" :class="{ compact }">
    <header class="report-head">
      <div class="report-title">
        <span class="section-kicker">Continuity review</span>
        <h3>故事一致性检查</h3>
        <p v-if="metaText" class="report-meta">{{ metaText }}</p>
      </div>
      <div class="overall-badge" :class="verdictClass">
        <strong class="mono">{{ report.overallScore }}</strong>
        <span>{{ report.passed ? '可继续' : '需修正' }}</span>
      </div>
    </header>

    <p class="overall-copy">{{ report.overall }}</p>

    <div class="dimension-grid">
      <div
        v-for="dimension in report.dimensions"
        :key="dimension.key"
        class="dimension"
        :class="scoreClass(dimension.score)"
      >
        <div class="dimension-line">
          <span>{{ dimension.label }}</span>
          <b class="mono">{{ dimension.score }}</b>
        </div>
        <div class="score-track" aria-hidden="true">
          <i :style="{ width: `${dimension.score}%` }" />
        </div>
        <small>
          {{ dimension.issueCount ? `${dimension.issueCount} 处待看` : '未发现问题' }}
        </small>
      </div>
    </div>

    <div v-if="report.style" class="style-strip">
      <span>文风贴近度 <b class="mono">{{ report.style.personalFit ?? report.style.score }}</b></span>
      <i />
      <span>AI 味 <b class="mono">{{ report.style.aiFlavor }}</b></span>
      <i />
      <span>{{ report.style.level }}</span>
    </div>

    <div class="issue-area">
      <div class="issue-heading">
        <h4>具体问题</h4>
        <span>{{ report.issues.length }} 处</span>
      </div>

      <div v-if="!report.issues.length" class="no-issue">
        <span class="no-issue-mark">安</span>
        <div>
          <strong>没有发现设定层面的明显冲突。</strong>
          <p>这表示稿件与当前故事记忆卡不矛盾；最终仍建议回到原文读一遍语感。</p>
        </div>
      </div>

      <article
        v-for="issue in report.issues"
        :key="issue.id"
        class="issue-card"
        :class="issue.severity"
      >
        <header class="issue-top">
          <span class="issue-dimension">{{ issue.dimensionLabel }}</span>
          <span class="severity-chip" :class="issue.severity">
            {{ severityMeta(issue.severity).label }}
          </span>
          <span class="issue-location">{{ issue.location }}</span>
        </header>

        <h5>{{ issue.problem }}</h5>

        <blockquote v-if="issue.excerpt">
          {{ issue.excerpt }}
        </blockquote>

        <div class="issue-detail">
          <span>设定依据</span>
          <p>{{ issue.evidence }}</p>
        </div>
        <div class="issue-detail suggestion">
          <span>修改建议</span>
          <p>{{ issue.suggestion }}</p>
        </div>
      </article>
    </div>

    <p class="report-foot">
      检查以故事记忆卡和最近章节为依据。记忆卡没记录的信息可能被判为“存疑”，
      可以回到记忆卡补一条纠正后再查。
    </p>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { severityMeta } from '../utils/format';

const props = defineProps({
  report: { type: Object, required: true },
  title: { type: String, default: '' },
  charCount: { type: Number, default: 0 },
  compact: { type: Boolean, default: false },
});

const metaText = computed(() => {
  const parts = [];
  if (props.title) parts.push(`《${props.title}》`);
  if (props.charCount) parts.push(`${props.charCount} 字`);
  return parts.join(' · ');
});

const verdictClass = computed(() => {
  if (props.report.passed) return 'pass';
  if (props.report.issues.some((issue) => issue.severity === 'high')) return 'fail';
  return 'warn';
});

function scoreClass(score) {
  if (score >= 80) return 'good';
  if (score >= 60) return 'fair';
  return 'poor';
}
</script>

<style scoped>
.consistency-report {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.report-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.report-title h3 {
  margin-top: 2px;
  font-size: 19px;
}

.report-meta {
  margin-top: 4px;
  color: var(--muted-soft);
  font-size: 9px;
}

.overall-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 62px;
  height: 62px;
  border: 1px solid var(--line-strong);
  border-radius: 50%;
  background: var(--paper-bright);
}

.overall-badge strong {
  font-size: 20px;
  line-height: 1;
}

.overall-badge span {
  margin-top: 3px;
  color: var(--muted-soft);
  font-size: 8px;
}

.overall-badge.pass {
  border-color: rgba(69, 100, 82, 0.5);
  color: var(--jade);
}

.overall-badge.warn {
  border-color: rgba(155, 123, 66, 0.5);
  color: var(--gold);
}

.overall-badge.fail {
  border-color: rgba(185, 65, 43, 0.5);
  color: var(--vermilion);
}

.overall-copy {
  padding: 11px 13px;
  border-left: 2px solid var(--line-strong);
  background: rgba(255, 253, 248, 0.42);
  color: var(--ink-soft);
  font-size: 11.5px;
  line-height: 1.75;
}

.dimension-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 7px;
}

.dimension {
  padding: 9px 10px 8px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: rgba(255, 253, 248, 0.4);
}

.dimension-line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
  color: var(--muted);
  font-size: 9.5px;
}

.dimension-line b {
  font-size: 11px;
  font-weight: 600;
}

.dimension.good .dimension-line b {
  color: var(--jade);
}

.dimension.fair .dimension-line b {
  color: var(--gold);
}

.dimension.poor .dimension-line b {
  color: var(--vermilion);
}

.score-track {
  height: 2px;
  margin-top: 6px;
  border-radius: 2px;
  background: rgba(28, 27, 24, 0.08);
  overflow: hidden;
}

.score-track i {
  display: block;
  height: 100%;
  background: var(--jade);
  transition: width 0.4s ease;
}

.dimension.fair .score-track i {
  background: var(--gold);
}

.dimension.poor .score-track i {
  background: var(--vermilion);
}

.dimension small {
  display: block;
  margin-top: 5px;
  color: var(--muted-soft);
  font-size: 8px;
}

.style-strip {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  color: var(--muted);
  font-size: 9px;
}

.style-strip b {
  color: var(--ink-soft);
  font-weight: 600;
}

.style-strip i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--line-strong);
}

.issue-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.issue-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 7px;
  border-bottom: 1px solid var(--line);
}

.issue-heading h4 {
  font-family: var(--font-serif);
  font-size: 13px;
  font-weight: 600;
}

.issue-heading span {
  color: var(--muted-soft);
  font-size: 9px;
}

.no-issue {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 1px solid rgba(69, 100, 82, 0.2);
  border-radius: 6px;
  background: rgba(69, 100, 82, 0.04);
}

.no-issue-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 32px;
  height: 32px;
  border: 1px solid rgba(69, 100, 82, 0.35);
  border-radius: 50%;
  color: var(--jade);
  font-family: var(--font-serif);
  font-size: 14px;
}

.no-issue strong {
  font-family: var(--font-serif);
  font-size: 11.5px;
  font-weight: 600;
}

.no-issue p {
  margin-top: 3px;
  color: var(--muted-soft);
  font-size: 9px;
  line-height: 1.6;
}

.issue-card {
  padding: 12px 13px;
  border: 1px solid var(--line);
  border-left-width: 2px;
  border-radius: 5px;
  background: rgba(255, 253, 248, 0.44);
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
  flex-wrap: wrap;
  gap: 6px;
}

.issue-dimension {
  color: var(--ink-soft);
  font-size: 9.5px;
  font-weight: 600;
}

.severity-chip {
  padding: 1px 5px;
  border: 1px solid var(--line);
  border-radius: 2px;
  color: var(--muted);
  font-size: 8px;
}

.severity-chip.high {
  border-color: rgba(185, 65, 43, 0.26);
  background: rgba(185, 65, 43, 0.06);
  color: var(--vermilion);
}

.severity-chip.medium {
  border-color: rgba(155, 123, 66, 0.26);
  background: rgba(155, 123, 66, 0.06);
  color: var(--gold);
}

.issue-location {
  margin-left: auto;
  color: var(--muted-soft);
  font-size: 8.5px;
}

.issue-card h5 {
  margin-top: 7px;
  color: var(--ink);
  font-family: var(--font-sans);
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1.6;
}

.issue-card blockquote {
  margin: 8px 0 0;
  padding: 8px 10px;
  border: 0;
  border-left: 2px solid var(--line-strong);
  background: rgba(28, 27, 24, 0.03);
  color: var(--ink-soft);
  font-family: var(--font-serif);
  font-size: 11px;
  line-height: 1.75;
}

.issue-detail {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.issue-detail span {
  flex: none;
  width: 48px;
  padding-top: 1px;
  color: var(--muted-soft);
  font-size: 8.5px;
}

.issue-detail p {
  color: var(--muted);
  font-size: 9.5px;
  line-height: 1.7;
}

.issue-detail.suggestion p {
  color: var(--jade);
}

.report-foot {
  padding-top: 9px;
  border-top: 1px solid var(--line);
  color: var(--muted-soft);
  font-size: 8.5px;
  line-height: 1.7;
}

.consistency-report.compact {
  gap: 12px;
}

@media (max-width: 720px) {
  .dimension-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .issue-location {
    width: 100%;
    margin-left: 0;
  }
}
</style>
