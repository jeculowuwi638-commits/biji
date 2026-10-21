<template>
  <section class="candidate-panel paper-card">
    <header class="candidate-head">
      <div>
        <span class="section-kicker">Second take</span>
        <h3>侧边候选稿</h3>
      </div>
      <span
        v-if="scoreValue != null"
        class="score-badge"
        :style="{ color: tone.color, background: tone.soft }"
      >
        {{ scoreValue }} 分
      </span>
    </header>

    <p class="candidate-note">
      当前文章没有被改动。这是另一次独立生成的结果，不会在当前稿上修改；
      觉得更好再替换，不替换就继续写当前这篇。
    </p>

    <div v-if="candidate.loading" class="candidate-loading">
      <span class="loading-dot" />
      <div>
        <strong>正在重新写一遍</strong>
        <p>不会把当前文章交给 AI，也不会在它的基础上调整。</p>
      </div>
    </div>

    <template v-else>
      <h4 v-if="candidate.title" class="candidate-title">{{ candidate.title }}</h4>
      <div class="candidate-text content-prose">{{ candidate.content }}</div>

      <div class="candidate-foot">
        <span class="mono">{{ charCount }} 字</span>
        <span v-if="candidate.scoring" class="candidate-status">正在检测这一版…</span>
        <span v-else-if="diffText" class="candidate-status" :class="{ better: diff > 0, worse: diff < 0 }">
          {{ diffText }}
        </span>
        <span v-else-if="scoreValue != null" class="candidate-status">候选稿得分 {{ scoreValue }}</span>
      </div>

      <div class="candidate-actions">
        <el-button type="primary" @click="emit('accept')">
          <el-icon><Select /></el-icon>
          替换当前文章
        </el-button>
        <el-button @click="emit('dismiss')">保留当前文章</el-button>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { countChars, scoreTone } from '../utils/format';

const props = defineProps({
  candidate: { type: Object, required: true },
  currentScore: { type: Number, default: null },
});
const emit = defineEmits(['accept', 'dismiss']);

const scoreValue = computed(() => props.candidate.score?.score ?? null);
const charCount = computed(() => countChars(props.candidate.content));
const tone = computed(() => scoreTone(scoreValue.value ?? 0));
const diff = computed(() =>
  scoreValue.value != null && props.currentScore != null
    ? scoreValue.value - props.currentScore
    : null
);
const diffText = computed(() => {
  if (diff.value == null) return '';
  if (diff.value > 0) return `比当前稿高 ${diff.value} 分`;
  if (diff.value < 0) return `比当前稿低 ${Math.abs(diff.value)} 分，仍可替换`;
  return '与当前稿同分';
});
</script>

<style scoped>
.candidate-panel {
  padding: 20px 20px 18px;
  animation: rise 0.4s cubic-bezier(0.22, 0.8, 0.3, 1) both;
}

.candidate-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--line);
}

.candidate-head h3 {
  margin-top: 4px;
  font-size: 17px;
}

.score-badge {
  flex: none;
  padding: 3px 8px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
}

.candidate-note {
  margin-top: 12px;
  color: var(--muted);
  font-size: 10.5px;
  line-height: 1.7;
}

.candidate-loading {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 18px;
  padding: 16px 14px;
  border: 1px dashed var(--line-strong);
  border-radius: 6px;
  background: rgba(255, 253, 248, 0.5);
}

.loading-dot {
  width: 7px;
  height: 7px;
  margin-top: 5px;
  flex: none;
  border-radius: 50%;
  background: var(--vermilion);
  animation: pulse 1.2s ease-in-out infinite;
}

.candidate-loading strong {
  font-family: var(--font-serif);
  font-size: 13px;
  font-weight: 600;
}

.candidate-loading p {
  margin-top: 4px;
  color: var(--muted-soft);
  font-size: 10px;
  line-height: 1.6;
}

.candidate-title {
  margin-top: 16px;
  color: var(--ink);
  font-family: var(--font-serif);
  font-size: 17px;
  font-weight: 600;
  line-height: 1.45;
}

.candidate-text {
  max-height: 340px;
  overflow-y: auto;
  padding: 16px 2px 10px;
  font-family: var(--font-serif);
  font-size: 13px;
  line-height: 1.95;
  white-space: pre-wrap;
}

.candidate-text::-webkit-scrollbar {
  width: 4px;
}

.candidate-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--line);
  color: var(--muted-soft);
  font-size: 9px;
}

.candidate-status.better {
  color: var(--jade);
}

.candidate-status.worse {
  color: var(--gold);
}

.candidate-actions {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-top: 14px;
}

.candidate-actions .el-button {
  width: 100%;
  margin-left: 0;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}
</style>
