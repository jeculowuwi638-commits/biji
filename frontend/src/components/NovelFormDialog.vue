<template>
  <el-dialog
    :model-value="modelValue"
    :title="mode === 'create' ? '新建小说' : '作品设置'"
    width="620px"
    class="novel-form-dialog"
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="form-body">
      <label class="field">
        <span class="field-label">小说 / 作品名称</span>
        <el-input
          v-model="form.title"
          maxlength="120"
          show-word-limit
          placeholder="比如：雾港来信"
        />
      </label>

      <label class="field">
        <span class="field-label">故事简介与核心设定</span>
        <el-input
          v-model="form.description"
          type="textarea"
          :autosize="{ minRows: 4, maxRows: 8 }"
          maxlength="3000"
          show-word-limit
          resize="none"
          placeholder="题材、主要人物、故事从哪里开始、你最在意不能写崩的设定。"
        />
      </label>

      <div class="field">
        <span class="field-label">默认叙事视角</span>
        <div class="narrator-grid">
          <button
            v-for="item in narrators"
            :key="item.key"
            type="button"
            class="narrator-option"
            :class="{ active: form.narrator === item.key }"
            @click="form.narrator = item.key"
          >
            <strong>{{ item.label }}</strong>
            <span>{{ item.hint }}</span>
          </button>
        </div>
      </div>

      <div class="setting-row">
        <div>
          <strong>严格遵守已有设定</strong>
          <p>续写时优先保住人物、时间线和世界观事实；发生冲突时不做强行走廊。</p>
        </div>
        <el-switch v-model="form.strictSettings" />
      </div>

      <label class="field">
        <span class="field-label">文风档案 <i>可选</i></span>
        <el-select
          v-model="form.styleProfileId"
          clearable
          placeholder="留空：分析章节后自动生成"
          style="width: 100%"
        >
          <el-option
            v-for="profile in profiles"
            :key="profile.id"
            :label="profile.name"
            :value="profile.id"
          />
        </el-select>
        <p class="field-hint">
          留空时，第一次分析故事记忆卡会用章节原文自动提取一份文风档案；也可以绑定已有档案。
        </p>
      </label>
    </div>

    <template #footer>
      <div class="dialog-foot">
        <span class="dialog-note">原始章节不会被改写，续写只追加新章节。</span>
        <div>
          <el-button @click="emit('update:modelValue', false)">取消</el-button>
          <el-button type="primary" :loading="submitting" @click="submit">
            {{ mode === 'create' ? '创建作品' : '保存设置' }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, reactive, watch } from 'vue';
import { ElMessage } from 'element-plus';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  mode: { type: String, default: 'create' },
  novel: { type: Object, default: null },
  profiles: { type: Array, default: () => [] },
  narrators: { type: Array, default: () => [] },
  submitting: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue', 'submit']);

const fallbackNarrators = [
  { key: 'first', label: '第一人称', hint: '以“我”的所见所知讲述，信息天然受限。' },
  {
    key: 'third-limited',
    label: '第三人称限知',
    hint: '跟随一个主要人物，只写他知道的事。',
  },
  {
    key: 'third-omniscient',
    label: '第三人称全知',
    hint: '叙述者知道多个人物的处境。',
  },
  { key: 'dual', label: '双视角交替', hint: '在两个主要人物的有限视角间切换。' },
];

const form = reactive({
  title: '',
  description: '',
  narrator: 'third-limited',
  strictSettings: true,
  styleProfileId: null,
});

function resetForm() {
  const novel = props.novel || {};
  form.title = String(novel.title || '');
  form.description = String(novel.description || '');
  form.narrator = novel.narrator || 'third-limited';
  form.strictSettings = novel.strictSettings !== false;
  form.styleProfileId = novel.styleProfile?.id ?? novel.styleProfileId ?? null;
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) resetForm();
  }
);

watch(
  () => props.novel,
  () => {
    if (props.modelValue) resetForm();
  },
  { deep: true }
);

function submit() {
  const title = form.title.trim();
  if (!title) {
    ElMessage.warning('先给这部作品起一个名字');
    return;
  }
  emit('submit', {
    title,
    description: form.description.trim(),
    narrator: form.narrator,
    strictSettings: form.strictSettings,
    styleProfileId: form.styleProfileId || null,
  });
}

const narrators = computed(() =>
  props.narrators?.length ? props.narrators : fallbackNarrators
);
</script>

<style scoped>
.form-body {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-height: 62vh;
  overflow-y: auto;
  padding: 2px 2px 4px;
}

.form-body::-webkit-scrollbar {
  width: 4px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  color: var(--ink-soft);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.03em;
}

.field-label i {
  margin-left: 4px;
  color: var(--muted-soft);
  font-size: 9px;
  font-style: normal;
  font-weight: 400;
}

.field-hint {
  color: var(--muted-soft);
  font-size: 9.5px;
  line-height: 1.65;
}

.narrator-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
}

.narrator-option {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 68px;
  padding: 10px 11px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: rgba(255, 253, 248, 0.45);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.narrator-option:hover {
  border-color: var(--line-strong);
}

.narrator-option.active {
  border-color: rgba(185, 65, 43, 0.45);
  background: rgba(185, 65, 43, 0.06);
}

.narrator-option strong {
  font-family: var(--font-serif);
  font-size: 12px;
  font-weight: 600;
}

.narrator-option span {
  color: var(--muted-soft);
  font-size: 9px;
  line-height: 1.5;
}

.setting-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: rgba(255, 253, 248, 0.55);
}

.setting-row strong {
  font-family: var(--font-serif);
  font-size: 13px;
  font-weight: 600;
}

.setting-row p {
  margin-top: 4px;
  color: var(--muted-soft);
  font-size: 9.5px;
  line-height: 1.6;
}

.setting-row .el-switch {
  flex: none;
  margin-top: 2px;
}

.dialog-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
}

.dialog-note {
  color: var(--muted-soft);
  font-size: 9px;
  line-height: 1.5;
  text-align: left;
}

@media (max-width: 640px) {
  .narrator-grid {
    grid-template-columns: 1fr;
  }

  .dialog-foot {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .dialog-foot > div {
    display: flex;
    justify-content: flex-end;
  }
}
</style>
