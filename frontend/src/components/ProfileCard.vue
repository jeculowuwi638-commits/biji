<template>
  <article class="profile-card paper-card" @click="goDetail">
    <div class="card-top">
      <span class="card-index mono">{{ String(index + 1).padStart(2, '0') }}</span>
      <span class="card-date mono">{{ formatDate(profile.createdAt) }}</span>
    </div>

    <h3 class="card-name">{{ profile.name }}</h3>
    <p class="card-summary">{{ profile.semantic?.summary || '这份档案还没有摘要。' }}</p>

    <div class="card-chips" v-if="catchphrases.length">
      <span v-for="phrase in catchphrases" :key="phrase" class="phrase-chip">
        {{ phrase }}
      </span>
    </div>

    <div class="card-metrics">
      <div class="metric">
        <strong class="mono">{{ stats.avgSentenceLength ?? '—' }}</strong>
        <span>平均句长</span>
      </div>
      <div class="metric">
        <strong class="mono">{{ stats.formality ?? '—' }}<small>%</small></strong>
        <span>正式度</span>
      </div>
      <div class="metric">
        <strong class="mono">{{ stats.colloquialism ?? '—' }}<small>%</small></strong>
        <span>口语度</span>
      </div>
      <div class="metric">
        <strong class="mono">{{ semantic.viewpointStrength ?? '—' }}</strong>
        <span>观点强度</span>
      </div>
    </div>

    <div class="card-foot">
      <span class="article-count">
        <el-icon><Document /></el-icon>
        {{ stats.articleCount || 0 }} 篇 · {{ stats.charCount || 0 }} 字
      </span>
      <div class="card-actions">
        <el-tooltip content="删除档案" placement="top">
          <el-button
            text
            circle
            class="delete-btn"
            @click.stop="emit('delete', profile)"
          >
            <el-icon><Delete /></el-icon>
          </el-button>
        </el-tooltip>
        <el-button size="small" @click.stop="emit('use', profile)">用它写作</el-button>
        <el-button size="small" type="primary" plain @click.stop="goDetail">查看档案</el-button>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { formatDate } from '../utils/format';

const props = defineProps({
  profile: { type: Object, required: true },
  index: { type: Number, default: 0 },
});
const emit = defineEmits(['delete', 'use']);
const router = useRouter();

const stats = computed(() => props.profile.stats || {});
const semantic = computed(() => props.profile.semantic || {});
const catchphrases = computed(() => (semantic.value.catchphrases || []).slice(0, 3));

function goDetail() {
  router.push({ name: 'profile-detail', params: { id: props.profile.id } });
}
</script>

<style scoped>
.profile-card {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 310px;
  padding: 26px 26px 20px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.24s ease, box-shadow 0.24s ease, border-color 0.24s ease;
}

.profile-card::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 2px;
  background: var(--vermilion);
  opacity: 0;
  transition: opacity 0.24s ease;
}

.profile-card:hover {
  transform: translateY(-3px);
  border-color: var(--line-strong);
  box-shadow: var(--shadow-md);
}

.profile-card:hover::before {
  opacity: 1;
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--muted-soft);
  font-size: 10px;
  letter-spacing: 0.08em;
}

.card-index {
  color: var(--vermilion);
  font-weight: 600;
}

.card-name {
  margin-top: 18px;
  font-size: 26px;
  font-weight: 600;
  letter-spacing: -0.025em;
}

.card-summary {
  display: -webkit-box;
  margin-top: 10px;
  overflow: hidden;
  color: var(--muted);
  font-size: 12.5px;
  line-height: 1.8;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.card-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 26px;
  margin-top: 15px;
}

.phrase-chip {
  padding: 2px 8px;
  border: 1px solid var(--line);
  border-radius: 3px;
  background: rgba(255, 253, 248, 0.6);
  color: var(--muted);
  font-size: 10.5px;
}

.card-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}

.metric strong {
  display: block;
  color: var(--ink-soft);
  font-family: var(--font-serif);
  font-size: 19px;
  font-weight: 600;
  line-height: 1.2;
}

.metric small {
  margin-left: 1px;
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 400;
}

.metric span {
  display: block;
  margin-top: 4px;
  color: var(--muted-soft);
  font-size: 9.5px;
}

.card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: auto;
  padding-top: 20px;
}

.article-count {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--muted-soft);
  font-size: 10px;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.delete-btn {
  color: var(--muted-soft);
}

.delete-btn:hover {
  color: var(--vermilion);
}

@media (max-width: 520px) {
  .card-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    row-gap: 12px;
  }

  .card-foot {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
