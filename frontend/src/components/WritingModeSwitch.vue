<template>
  <div class="mode-switch" role="tablist" aria-label="写作模式">
    <button
      type="button"
      role="tab"
      class="mode-tab"
      :class="{ active: mode === 'article' }"
      :aria-selected="mode === 'article'"
      @click="go('article')"
    >
      <span class="mode-mark">文</span>
      <span class="mode-copy">
        <strong>普通文章</strong>
        <small>单篇 · 按平台发布</small>
      </span>
    </button>
    <button
      type="button"
      role="tab"
      class="mode-tab"
      :class="{ active: mode === 'novel' }"
      :aria-selected="mode === 'novel'"
      @click="go('novel')"
    >
      <span class="mode-mark">说</span>
      <span class="mode-copy">
        <strong>小说续写</strong>
        <small>长篇 · 设定与文风连续</small>
      </span>
    </button>
  </div>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router';

const props = defineProps({
  mode: {
    type: String,
    default: 'article',
    validator: (value) => ['article', 'novel'].includes(value),
  },
});

const route = useRoute();
const router = useRouter();

function go(target) {
  if (target === props.mode) return;
  if (target === 'article') {
    router.push({ name: 'write' });
    return;
  }
  // 从小说工作台切回来时，优先回到那本书；否则进入作品列表。
  const novelId = route.name === 'novel-workspace' ? Number(route.params.id) : 0;
  if (Number.isInteger(novelId) && novelId > 0) {
    router.push({ name: 'novel-workspace', params: { id: novelId } });
  } else {
    router.push({ name: 'novels' });
  }
}
</script>

<style scoped>
.mode-switch {
  display: inline-flex;
  align-items: stretch;
  gap: 3px;
  margin-bottom: 18px;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(255, 253, 248, 0.46);
}

.mode-tab {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 176px;
  padding: 8px 14px 8px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  text-align: left;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
}

.mode-tab:hover {
  color: var(--ink-soft);
}

.mode-tab:focus-visible {
  outline: 2px solid var(--vermilion);
  outline-offset: 1px;
}

.mode-tab.active {
  background: var(--paper-bright);
  color: var(--ink);
  box-shadow: 0 2px 9px rgba(50, 38, 20, 0.07);
}

.mode-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 27px;
  height: 27px;
  border: 1px solid var(--line);
  border-radius: 50%;
  color: var(--muted);
  font-family: var(--font-serif);
  font-size: 13px;
  line-height: 1;
  transition: border-color 0.2s ease, background-color 0.2s ease, color 0.2s ease;
}

.mode-tab.active .mode-mark {
  border-color: var(--vermilion);
  background: var(--vermilion);
  color: var(--paper-bright);
}

.mode-copy {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.mode-copy strong {
  font-family: var(--font-serif);
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.35;
}

.mode-copy small {
  color: var(--muted-soft);
  font-size: 8.5px;
  line-height: 1.35;
  letter-spacing: 0.02em;
}

@media (max-width: 640px) {
  .mode-switch {
    display: flex;
    width: 100%;
  }

  .mode-tab {
    flex: 1;
    min-width: 0;
  }

  .mode-copy small {
    display: none;
  }
}
</style>
