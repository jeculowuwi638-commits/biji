<template>
  <section class="editor-card paper-card">
    <header class="editor-head">
      <div class="editor-identity">
        <span class="section-kicker">Writing desk</span>
        <div class="editor-meta">
          <span>{{ platformLabel || '未选择平台' }}</span>
          <i />
          <span>{{ profileName || '不使用档案' }}</span>
          <i />
          <span>{{ createdAt ? formatDateTime(createdAt) : '尚未生成' }}</span>
        </div>
      </div>

      <div class="editor-actions">
        <el-button text size="small" @click="emit('new')">新建</el-button>
        <el-button size="small" :disabled="!modelValue" @click="emit('copy')">
          <el-icon><CopyDocument /></el-icon>
          复制
        </el-button>
        <el-button
          size="small"
          :loading="scoring"
          :disabled="!modelValue"
          @click="emit('score')"
        >
          <el-icon v-if="!scoring"><Aim /></el-icon>
          {{ hasScore ? '重新检测' : '检测像不像你' }}
        </el-button>
        <el-button
          size="small"
          :loading="generating"
          :disabled="!canRegenerate"
          @click="emit('regenerate')"
        >
          <el-icon v-if="!generating"><Refresh /></el-icon>
          重新生成
        </el-button>
        <el-button
          type="primary"
          size="small"
          :loading="saving"
          :disabled="!canSave"
          @click="emit('save')"
        >
          <el-icon v-if="!saving"><DocumentAdd /></el-icon>
          {{ saved ? '保存修改' : '保存文章' }}
        </el-button>
      </div>
    </header>

    <div class="title-row">
      <input
        :value="title"
        class="title-input"
        maxlength="120"
        placeholder="给这篇文章起个标题（可选）"
        @input="emit('update:title', $event.target.value)"
      />
      <span class="save-state" :class="{ dirty, saved: saved && !dirty }">
        <i />
        <template v-if="saving">保存中…</template>
        <template v-else-if="dirty">有未保存修改</template>
        <template v-else-if="saved">已保存 · {{ formatDateTime(savedAt) }}</template>
        <template v-else>尚未保存</template>
      </span>
    </div>

    <el-input
      class="article-textarea"
      type="textarea"
      :model-value="modelValue"
      :autosize="{ minRows: 18, maxRows: 42 }"
      resize="none"
      placeholder="生成后，正文会出现在这里。你也可以直接开始写；写完后可以检测像不像你，再保存到「我的文章」。"
      @update:model-value="emit('update:modelValue', $event)"
    />

    <footer class="editor-foot">
      <div class="word-status" :class="wordStatusClass">
        <i />
        {{ wordStatusText }}
      </div>
      <span class="editor-hint">
        手动修改后可以重新检测；保存后会出现在「我的文章」里。
      </span>
    </footer>
  </section>
</template>

<script setup>
import { formatDateTime } from '../utils/format';

defineProps({
  modelValue: { type: String, default: '' },
  title: { type: String, default: '' },
  platformLabel: { type: String, default: '' },
  profileName: { type: String, default: '' },
  createdAt: { type: [String, Date], default: null },
  wordStatusText: { type: String, default: '' },
  wordStatusClass: { type: String, default: '' },
  saving: { type: Boolean, default: false },
  saved: { type: Boolean, default: false },
  savedAt: { type: [String, Date], default: null },
  dirty: { type: Boolean, default: false },
  scoring: { type: Boolean, default: false },
  hasScore: { type: Boolean, default: false },
  generating: { type: Boolean, default: false },
  canRegenerate: { type: Boolean, default: false },
  canSave: { type: Boolean, default: false },
});

const emit = defineEmits([
  'update:modelValue',
  'update:title',
  'save',
  'regenerate',
  'score',
  'copy',
  'new',
]);
</script>

<style scoped>
.editor-card {
  overflow: hidden;
  animation: rise 0.45s cubic-bezier(0.22, 0.8, 0.3, 1) both;
}

.editor-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 24px 26px 18px;
  border-bottom: 1px solid var(--line);
}

.editor-identity {
  min-width: 0;
}

.editor-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 7px;
  color: var(--muted-soft);
  font-size: 9.5px;
}

.editor-meta i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--line-strong);
}

.editor-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  flex: none;
  max-width: 430px;
}

.editor-actions .el-button {
  margin-left: 0;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 26px 30px 4px;
}

.title-input {
  min-width: 0;
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: var(--ink);
  font-family: var(--font-serif);
  font-size: clamp(22px, 2.4vw, 29px);
  font-weight: 600;
  letter-spacing: -0.025em;
  line-height: 1.35;
}

.title-input::placeholder {
  color: var(--muted-soft);
  font-weight: 400;
}

.save-state {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: none;
  color: var(--muted-soft);
  font-size: 9.5px;
  white-space: nowrap;
}

.save-state i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--line-strong);
}

.save-state.dirty {
  color: var(--gold);
}

.save-state.dirty i {
  background: var(--gold);
}

.save-state.saved {
  color: var(--jade);
}

.save-state.saved i {
  background: var(--jade);
}

.article-textarea {
  display: block;
  padding: 14px 30px 8px;
}

.article-textarea :deep(.el-textarea__inner) {
  min-height: 360px !important;
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: var(--ink);
  font-family: var(--font-serif);
  font-size: 16.5px;
  line-height: 2.05;
  resize: none;
}

.article-textarea :deep(.el-textarea__inner:focus) {
  box-shadow: none;
}

.article-textarea :deep(.el-textarea__inner::placeholder) {
  color: var(--muted-soft);
  font-family: var(--font-serif);
  line-height: 2;
}

.editor-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 13px 30px;
  border-top: 1px solid var(--line);
  background: rgba(255, 253, 248, 0.42);
}

.word-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 9.5px;
}

.word-status i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--line-strong);
}

.word-status.ok {
  color: var(--jade);
}

.word-status.ok i {
  background: var(--jade);
}

.word-status.short {
  color: var(--gold);
}

.word-status.short i {
  background: var(--gold);
}

.word-status.long {
  color: var(--vermilion);
}

.word-status.long i {
  background: var(--vermilion);
}

.editor-hint {
  color: var(--muted-soft);
  font-size: 9px;
  text-align: right;
}

@media (max-width: 760px) {
  .editor-head {
    flex-direction: column;
    padding: 20px 18px 16px;
  }

  .editor-actions {
    justify-content: flex-start;
    max-width: none;
  }

  .title-row {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
    padding: 20px 20px 4px;
  }

  .article-textarea {
    padding: 12px 20px 6px;
  }

  .article-textarea :deep(.el-textarea__inner) {
    font-size: 16px;
  }

  .editor-foot {
    flex-direction: column;
    align-items: flex-start;
    gap: 7px;
    padding: 12px 20px;
  }

  .editor-hint {
    text-align: left;
  }
}
</style>
