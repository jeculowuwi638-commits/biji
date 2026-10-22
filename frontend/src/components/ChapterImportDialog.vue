<template>
  <el-dialog
    :model-value="modelValue"
    title="导入章节"
    width="700px"
    class="chapter-import-dialog"
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
    @open="reset"
  >
    <div class="import-tabs" role="tablist" aria-label="导入方式">
      <button
        type="button"
        role="tab"
        class="import-tab"
        :class="{ active: tab === 'upload' }"
        :aria-selected="tab === 'upload'"
        @click="tab = 'upload'"
      >
        <el-icon><UploadFilled /></el-icon>
        上传文件
      </button>
      <button
        type="button"
        role="tab"
        class="import-tab"
        :class="{ active: tab === 'paste' }"
        :aria-selected="tab === 'paste'"
        @click="tab = 'paste'"
      >
        <el-icon><EditPen /></el-icon>
        粘贴正文
      </button>
    </div>

    <div v-if="tab === 'upload'" class="import-body">
      <label
        class="drop-zone"
        :class="{ dragging }"
        @dragenter.prevent="dragging = true"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="handleDrop"
      >
        <input
          ref="fileInput"
          type="file"
          accept=".txt,.md,text/plain,text/markdown"
          multiple
          @change="handleFileInput"
        />
        <span class="drop-mark">稿</span>
        <strong>选择或拖入章节文件</strong>
        <p>支持 .txt / .md，可一次选多章；每个文件作为一章，文件名会变成章节名。</p>
      </label>

      <div v-if="demoChapters.length" class="demo-row">
        <span>没有现成文稿？</span>
        <el-button text size="small" @click="fillDemo">
          <el-icon><MagicStick /></el-icon>
          填入《{{ demoTitle || '演示小说' }}》三章
        </el-button>
      </div>

      <div v-if="draftChapters.length" class="draft-list">
        <div class="draft-head">
          <span>本次将导入 {{ draftChapters.length }} 章</span>
          <el-button text size="small" @click="draftChapters = []">清空</el-button>
        </div>
        <div v-for="(chapter, index) in draftChapters" :key="`${chapter.title}-${index}`" class="draft-row">
          <span class="draft-no mono">{{ String(index + 1).padStart(2, '0') }}</span>
          <div class="draft-copy">
            <strong>{{ chapter.title }}</strong>
            <span>{{ countChars(chapter.content).toLocaleString('zh-CN') }} 字</span>
          </div>
          <el-button text size="small" @click="draftChapters.splice(index, 1)">
            移除
          </el-button>
        </div>
      </div>

      <p v-if="fileError" class="file-error">{{ fileError }}</p>
    </div>

    <div v-else class="import-body">
      <label class="field">
        <span class="field-label">章节名称</span>
        <el-input v-model="pasteTitle" maxlength="160" placeholder="比如：第四章 潮汐表" />
      </label>
      <label class="field">
        <span class="field-label">章节正文</span>
        <el-input
          v-model="pasteContent"
          type="textarea"
          :autosize="{ minRows: 12, maxRows: 20 }"
          maxlength="200000"
          resize="none"
          placeholder="把这一章原文完整贴进来，段落和标点会原样保存。"
        />
      </label>
      <p class="paste-note">
        粘贴只会新增章节，不会覆盖已有正文。首次导入后会自动提取故事记忆卡；
        之后再投喂新章节，需要手动点“重新分析”把新事实并进去。
      </p>
    </div>

    <template #footer>
      <div class="dialog-foot">
        <span class="dialog-note">
          一次最多 20 章；原文只属于当前账号。首次导入会自动调用模型分析。
        </span>
        <div>
          <el-button @click="emit('update:modelValue', false)">取消</el-button>
          <el-button type="primary" :loading="submitting" @click="submit">
            {{ pendingCount ? `导入 ${pendingCount} 章` : '导入章节' }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { countChars } from '../utils/format';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
  demoTitle: { type: String, default: '' },
  demoChapters: { type: Array, default: () => [] },
  nextChapterNumber: { type: Number, default: 1 },
});
const emit = defineEmits(['update:modelValue', 'submit']);

const tab = ref('upload');
const dragging = ref(false);
const fileError = ref('');
const fileInput = ref(null);
const draftChapters = ref([]);
const pasteTitle = ref('');
const pasteContent = ref('');

const pendingCount = computed(() =>
  tab.value === 'paste' && pasteContent.value.trim() ? 1 : draftChapters.value.length
);

function reset() {
  tab.value = 'upload';
  dragging.value = false;
  fileError.value = '';
  draftChapters.value = [];
  pasteTitle.value = '';
  pasteContent.value = '';
  if (fileInput.value) fileInput.value.value = '';
}

function titleFromFile(name) {
  return String(name || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .slice(0, 160);
}

function addFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve();
    if (!/\.(txt|md)$/i.test(file.name)) {
      reject(new Error(`「${file.name}」不是 .txt / .md 文件`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '').replace(/\r\n/g, '\n').trim();
      if (!content) {
        reject(new Error(`「${file.name}」没有正文`));
        return;
      }
      if (content.length > 200000) {
        reject(new Error(`「${file.name}」超过单章 20 万字符上限`));
        return;
      }
      draftChapters.value.push({
        title: titleFromFile(file.name) || `第 ${draftChapters.value.length + 1} 章`,
        content,
      });
      resolve();
    };
    reader.onerror = () => reject(new Error(`读取「${file.name}」失败`));
    reader.readAsText(file, 'UTF-8');
  });
}

async function addFiles(files) {
  fileError.value = '';
  const list = [...files].slice(0, 20 - draftChapters.value.length);
  if (!list.length) {
    fileError.value = '一次最多导入 20 章';
    return;
  }
  for (const file of list) {
    try {
      await addFile(file);
    } catch (error) {
      fileError.value = error.message;
    }
  }
  if (files.length > list.length) {
    fileError.value = '一次最多导入 20 章，超出的文件没有加入';
  }
}

function handleFileInput(event) {
  addFiles(event.target.files || []);
  event.target.value = '';
}

function handleDrop(event) {
  dragging.value = false;
  addFiles(event.dataTransfer?.files || []);
}

function fillDemo() {
  fileError.value = '';
  draftChapters.value = props.demoChapters.map((chapter, index) => ({
    title: String(chapter.title || `第 ${index + 1} 章`).slice(0, 160),
    content: String(chapter.content || '').replace(/\r\n/g, '\n').trim(),
  }));
  ElMessage.success('演示章节已填入，确认后会导入到当前作品');
}

function submit() {
  if (tab.value === 'paste') {
    const content = pasteContent.value.replace(/\r\n/g, '\n').trim();
    if (!content) {
      ElMessage.warning('先把章节正文贴进来');
      return;
    }
    emit('submit', [
      {
        title: pasteTitle.value.trim() || `第 ${props.nextChapterNumber} 章`,
        content,
      },
    ]);
    return;
  }

  if (!draftChapters.value.length) {
    ElMessage.warning('先选择章节文件，或切到“粘贴正文”');
    return;
  }
  emit('submit', draftChapters.value.map((chapter) => ({ ...chapter })));
}
</script>

<style scoped>
.import-tabs {
  display: inline-flex;
  gap: 3px;
  margin-bottom: 16px;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: rgba(255, 253, 248, 0.45);
}

.import-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--muted);
  font-size: 11px;
  cursor: pointer;
}

.import-tab.active {
  background: var(--paper-bright);
  color: var(--ink);
  box-shadow: 0 1px 5px rgba(50, 38, 20, 0.07);
}

.import-tab .el-icon {
  font-size: 13px;
}

.import-body {
  display: flex;
  flex-direction: column;
  gap: 13px;
  max-height: 55vh;
  overflow-y: auto;
  padding: 1px 2px 3px;
}

.import-body::-webkit-scrollbar {
  width: 4px;
}

.drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 20px;
  border: 1px dashed var(--line-strong);
  border-radius: 7px;
  background: rgba(255, 253, 248, 0.36);
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.drop-zone:hover,
.drop-zone.dragging {
  border-color: var(--vermilion);
  background: rgba(185, 65, 43, 0.04);
}

.drop-zone input {
  display: none;
}

.drop-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  margin-bottom: 10px;
  border: 1px solid var(--line-strong);
  border-radius: 50%;
  color: var(--muted);
  font-family: var(--font-serif);
  font-size: 18px;
}

.drop-zone strong {
  font-family: var(--font-serif);
  font-size: 14px;
  font-weight: 600;
}

.drop-zone p {
  max-width: 420px;
  margin-top: 6px;
  color: var(--muted-soft);
  font-size: 9.5px;
  line-height: 1.7;
}

.demo-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--muted-soft);
  font-size: 10px;
}

.draft-list {
  border: 1px solid var(--line);
  border-radius: 6px;
  overflow: hidden;
}

.draft-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
  background: rgba(255, 253, 248, 0.55);
  color: var(--muted);
  font-size: 9.5px;
}

.draft-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-bottom: 1px solid var(--line);
}

.draft-row:last-child {
  border-bottom: 0;
}

.draft-no {
  flex: none;
  color: var(--vermilion);
  font-size: 9px;
}

.draft-copy {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}

.draft-copy strong {
  overflow: hidden;
  font-family: var(--font-serif);
  font-size: 11.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.draft-copy span {
  color: var(--muted-soft);
  font-size: 8.5px;
}

.file-error {
  color: var(--vermilion);
  font-size: 9.5px;
  line-height: 1.6;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.field-label {
  color: var(--ink-soft);
  font-size: 11px;
  font-weight: 600;
}

.paste-note {
  color: var(--muted-soft);
  font-size: 9.5px;
  line-height: 1.65;
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
