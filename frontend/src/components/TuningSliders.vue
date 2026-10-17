<template>
  <div class="tuning-sliders">
    <div v-for="item in items" :key="item.key" class="tuning-row">
      <div class="tuning-head">
        <div>
          <span class="tuning-label">{{ item.label }}</span>
          <span class="tuning-desc">{{ item.description }}</span>
        </div>
        <span class="tuning-value mono">{{ modelValue[item.key] ?? 50 }}</span>
      </div>
      <div class="tuning-control">
        <span class="endpoint">{{ item.left }}</span>
        <el-slider
          :model-value="modelValue[item.key] ?? 50"
          :min="0"
          :max="100"
          :step="5"
          :show-tooltip="false"
          @update:model-value="(value) => update(item.key, value)"
        />
        <span class="endpoint">{{ item.right }}</span>
      </div>
    </div>

    <div class="tuning-foot">
      <span>只在本次生成时生效，不会改动档案。</span>
      <el-button text size="small" @click="reset">
        <el-icon><RefreshLeft /></el-icon>
        重置为 50
      </el-button>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  modelValue: { type: Object, required: true },
});
const emit = defineEmits(['update:modelValue']);

const items = [
  {
    key: 'formality',
    label: '语气',
    description: '正式 ↔ 口语',
    left: '正式',
    right: '口语',
  },
  {
    key: 'detail',
    label: '密度',
    description: '简洁 ↔ 详尽',
    left: '简洁',
    right: '详尽',
  },
  {
    key: 'emotion',
    label: '情绪',
    description: '理性 ↔ 感性',
    left: '理性',
    right: '感性',
  },
  {
    key: 'assertiveness',
    label: '观点',
    description: '陈述 ↔ 鲜明',
    left: '只陈述',
    right: '很鲜明',
  },
];

const DEFAULT_TUNING = {
  formality: 50,
  detail: 50,
  emotion: 50,
  assertiveness: 50,
};

function update(key, value) {
  emit('update:modelValue', { ...props.modelValue, [key]: value });
}

function reset() {
  emit('update:modelValue', { ...DEFAULT_TUNING });
}
</script>

<style scoped>
.tuning-sliders {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 18px 18px 14px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: rgba(255, 253, 248, 0.55);
}

.tuning-row {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.tuning-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.tuning-label {
  color: var(--ink-soft);
  font-family: var(--font-serif);
  font-size: 13px;
  font-weight: 600;
}

.tuning-desc {
  margin-left: 8px;
  color: var(--muted-soft);
  font-size: 10px;
}

.tuning-value {
  min-width: 24px;
  color: var(--vermilion);
  font-size: 12px;
  font-weight: 600;
  text-align: right;
}

.tuning-control {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tuning-control :deep(.el-slider) {
  flex: 1;
}

.endpoint {
  width: 34px;
  color: var(--muted-soft);
  font-size: 9.5px;
  text-align: center;
}

.endpoint:last-child {
  text-align: right;
}

.tuning-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px dashed var(--line);
  color: var(--muted-soft);
  font-size: 10px;
}
</style>
