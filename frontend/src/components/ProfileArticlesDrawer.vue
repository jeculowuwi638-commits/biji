<template>
  <el-drawer
    :model-value="modelValue"
    :title="`已投喂文章 · ${profile?.name || '笔迹档案'}`"
    size="min(680px, 92vw)"
    class="articles-drawer"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="loading" class="drawer-loading">
      <el-skeleton :rows="7" animated />
    </div>

    <div v-else-if="errorMessage" class="drawer-state">
      <span class="state-icon"><el-icon><Warning /></el-icon></span>
      <h3>文章没有加载出来</h3>
      <p>{{ errorMessage }}</p>
      <el-button size="small" @click="load">
        <el-icon><Refresh /></el-icon>
        重试
      </el-button>
    </div>

    <template v-else-if="articles.length">
      <div class="drawer-intro">
        <div>
          <span class="section-kicker">Source corpus</span>
          <p>
            这些文章是这份档案的语料基线。继续投喂时，系统会把新文章和它们合并后重新分析。
          </p>
        </div>
        <div class="corpus-stats">
          <strong class="mono">{{ articles.length }}</strong>
          <span>篇</span>
          <i />
          <strong class="mono">{{ totalChars.toLocaleString('zh-CN') }}</strong>
          <span>字</span>
        </div>
      </div>

      <el-collapse v-model="activeNames" class="article-collapse">
        <el-collapse-item
          v-for="(article, index) in articles"
          :key="index"
          :name="String(index)"
        >
          <template #title>
            <div class="article-title-row">
              <span class="article-no mono">{{ String(index + 1).padStart(2, '0') }}</span>
              <span class="article-name">文章 {{ index + 1 }}</span>
              <span class="article-excerpt">{{ excerpt(article) }}</span>
              <span class="article-count mono">{{ charCount(article) }} 字</span>
            </div>
          </template>
          <pre class="article-body">{{ article }}</pre>
        </el-collapse-item>
      </el-collapse>

      <div class="drawer-note">
        <el-icon><Lock /></el-icon>
        <p>原文只保存在本机数据库中，仅当前账号可见；删除档案时会一并删除。</p>
      </div>
    </template>

    <div v-else class="drawer-state">
      <span class="state-icon"><el-icon><Document /></el-icon></span>
      <h3>这份档案没有保存原文</h3>
      <p>它可能创建于旧版本。你仍然可以使用它写作，但无法查看语料或继续追加。</p>
    </div>
  </el-drawer>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { profileApi } from '../api';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  profile: { type: Object, default: null },
});

const emit = defineEmits(['update:modelValue']);

const loading = ref(false);
const errorMessage = ref('');
const articles = ref([]);
const activeNames = ref([]);

// 与档案 stats.charCount 口径一致：不计空白字符。
function charCount(text) {
  return String(text || '').replace(/\s/g, '').length;
}

const totalChars = computed(() =>
  articles.value.reduce((sum, article) => sum + charCount(article), 0)
);

function excerpt(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 72);
}

async function load() {
  if (!props.profile?.id) return;
  loading.value = true;
  errorMessage.value = '';
  activeNames.value = [];
  try {
    const data = await profileApi.articles(props.profile.id);
    articles.value = data.articles || [];
  } catch (error) {
    articles.value = [];
    errorMessage.value = error.message || '请稍后再试';
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) load();
  }
);
</script>

<style scoped>
.articles-drawer {
  max-width: 92vw;
}

.articles-drawer :deep(.el-drawer__body) {
  padding-top: 4px;
}

.drawer-loading {
  padding: 12px 2px;
}

.drawer-intro {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 14px 16px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: rgba(255, 253, 248, 0.45);
}

.drawer-intro p {
  max-width: 400px;
  margin-top: 6px;
  color: var(--muted);
  font-size: 10.5px;
  line-height: 1.75;
}

.corpus-stats {
  display: flex;
  align-items: baseline;
  gap: 4px;
  flex: none;
  color: var(--muted-soft);
}

.corpus-stats strong {
  color: var(--ink-soft);
  font-family: var(--font-serif);
  font-size: 18px;
  font-weight: 600;
}

.corpus-stats span {
  font-size: 9px;
}

.corpus-stats i {
  width: 3px;
  height: 3px;
  margin: 0 5px;
  border-radius: 50%;
  background: var(--line-strong);
}

.article-collapse {
  margin-top: 18px;
  border-top: 1px solid var(--line);
}

.article-collapse :deep(.el-collapse-item__header) {
  height: auto;
  min-height: 52px;
  padding: 10px 2px;
  background: transparent;
}

.article-collapse :deep(.el-collapse-item__wrap) {
  background: transparent;
}

.article-title-row {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  min-width: 0;
  padding-right: 8px;
}

.article-no {
  flex: none;
  color: var(--vermilion);
  font-size: 9px;
  font-weight: 600;
}

.article-name {
  flex: none;
  color: var(--ink-soft);
  font-family: var(--font-serif);
  font-size: 12.5px;
  font-weight: 600;
}

.article-excerpt {
  overflow: hidden;
  color: var(--muted-soft);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.article-count {
  flex: none;
  margin-left: auto;
  color: var(--muted-soft);
  font-size: 9px;
}

.article-body {
  margin: 0 0 12px;
  padding: 14px 16px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: rgba(255, 253, 248, 0.55);
  color: var(--ink-soft);
  font-family: var(--font-serif);
  font-size: 12.5px;
  line-height: 2;
  white-space: pre-wrap;
  word-break: break-word;
}

.drawer-note {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin-top: 20px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
  color: var(--muted-soft);
}

.drawer-note .el-icon {
  margin-top: 2px;
  flex: none;
  font-size: 12px;
}

.drawer-note p {
  font-size: 9.5px;
  line-height: 1.7;
}

.drawer-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 70px 20px;
  text-align: center;
}

.state-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  margin-bottom: 16px;
  border: 1px solid var(--line-strong);
  border-radius: 50%;
  color: var(--muted-soft);
}

.drawer-state h3 {
  font-size: 17px;
}

.drawer-state p {
  max-width: 360px;
  margin: 8px 0 18px;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.75;
}

@media (max-width: 680px) {
  .drawer-intro {
    flex-direction: column;
    gap: 10px;
  }

  .article-excerpt {
    display: none;
  }
}
</style>
