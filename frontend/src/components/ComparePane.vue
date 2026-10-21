<template>
  <section class="compare-pane paper-card">
    <header class="compare-head">
      <div>
        <span class="section-kicker">Version A / B</span>
        <h3>{{ title }}</h3>
      </div>
      <p>{{ description }}</p>
    </header>

    <p
      v-if="scoreNote"
      class="compare-note"
      :class="{ dropped: afterScore < beforeScore }"
    >
      {{ scoreNote }}
    </p>

    <div class="compare-grid">
      <article class="compare-column before">
        <div class="column-head">
          <span class="column-label">{{ beforeLabel }}</span>
          <span v-if="beforeScore != null" class="score-badge" :style="badgeStyle(beforeScore)">
            {{ beforeScore }} 分
          </span>
        </div>
        <div class="compare-text content-prose">{{ before }}</div>
        <span class="char-count mono">{{ chars(before) }} 字</span>
      </article>

      <article class="compare-column after">
        <div class="column-head">
          <span class="column-label">{{ afterLabel }}</span>
          <span v-if="afterScore != null" class="score-badge" :style="badgeStyle(afterScore)">
            {{ afterScore }} 分
          </span>
        </div>
        <div class="compare-text content-prose">{{ after }}</div>
        <span class="char-count mono">{{ chars(after) }} 字</span>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { countChars, scoreTone } from '../utils/format';

const props = defineProps({
  before: { type: String, default: '' },
  after: { type: String, default: '' },
  beforeScore: { type: Number, default: null },
  afterScore: { type: Number, default: null },
  title: { type: String, default: '两版对比' },
  description: {
    type: String,
    default: '左边是上一次生成并检测过的版本，右边是重新生成后的版本；两版都会保留，只把右边作为当前稿。',
  },
  beforeLabel: { type: String, default: '上一版' },
  afterLabel: { type: String, default: '这一版' },
});

const scoreNote = computed(() => {
  if (props.beforeScore == null || props.afterScore == null) return '';
  const diff = props.afterScore - props.beforeScore;
  if (diff < 0) {
    return `这一版比上一版低 ${Math.abs(diff)} 分，已保留这一版；两版正文都在下面，可以对照查看。`;
  }
  if (diff > 0) return `这一版比上一版高 ${diff} 分，已保留这一版。`;
  return '两版分数相同，已保留这一版。';
});

function chars(text) {
  return countChars(text);
}

function badgeStyle(score) {
  const tone = scoreTone(score);
  return { color: tone.color, background: tone.soft };
}
</script>

<style scoped>
.compare-pane {
  padding: 24px 26px 22px;
  animation: rise 0.45s cubic-bezier(0.22, 0.8, 0.3, 1) both;
}

.compare-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--line);
}

.compare-head h3 {
  margin-top: 4px;
  font-size: 19px;
}

.compare-head p {
  max-width: 340px;
  color: var(--muted);
  font-size: 10.5px;
  line-height: 1.7;
  text-align: right;
}

.compare-note {
  margin-top: 14px;
  padding: 9px 12px;
  border-left: 2px solid var(--jade);
  border-radius: 4px;
  background: rgba(69, 100, 82, 0.06);
  color: var(--muted);
  font-size: 10.5px;
  line-height: 1.7;
}

.compare-note.dropped {
  border-left-color: var(--gold);
  background: rgba(169, 132, 69, 0.08);
}

.compare-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  padding-top: 18px;
}

.compare-column {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 15px 16px 12px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: rgba(255, 253, 248, 0.42);
}

.compare-column.after {
  border-color: rgba(69, 100, 82, 0.25);
  background: rgba(69, 100, 82, 0.035);
}

.column-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.column-label {
  color: var(--muted);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.12em;
}

.score-badge {
  padding: 2px 7px;
  border-radius: 3px;
  font-size: 9.5px;
  font-weight: 600;
}

.compare-text {
  max-height: 330px;
  overflow: auto;
  padding-right: 6px;
  font-family: var(--font-serif);
  font-size: 13px;
  line-height: 1.95;
  white-space: pre-wrap;
}

.char-count {
  margin-top: 10px;
  color: var(--muted-soft);
  font-size: 9px;
  text-align: right;
}

@media (max-width: 760px) {
  .compare-head {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .compare-head p {
    text-align: left;
  }

  .compare-grid {
    grid-template-columns: 1fr;
  }
}
</style>
