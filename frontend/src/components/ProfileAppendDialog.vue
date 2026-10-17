<template>
  <el-dialog
    :model-value="modelValue"
    :title="`继续投喂 · ${profile?.name || '笔迹档案'}`"
    width="760px"
    class="append-dialog"
    :close-on-click-modal="!submitting"
    :close-on-press-escape="!submitting"
    :show-close="!submitting"
    @update:model-value="handleVisibleChange"
  >
    <div class="append-intro">
      <span class="append-tag">
        <el-icon><Upload /></el-icon>
        APPEND ONLY
      </span>
      <p>
        新文章会和档案中保存的 {{ existingArticles }} 篇原文合并，重新计算统计层与语义层。
        档案名和创建时间不变，更新后的结果会立即用于后续生成与检测。
      </p>
    </div>

    <el-alert
      v-if="profile && profile.canAppend === false"
      class="append-alert"
      title="这份档案没有保存原始文章"
      type="warning"
      show-icon
      :closable="false"
    >
      <p class="alert-text">
        它创建于旧版本，无法在原文基础上增量分析。请新建一份档案，再继续投喂。
      </p>
    </el-alert>

    <template v-else>
      <div class="append-meter">
        <div class="meter-group">
          <div class="meter-item">
            <strong class="mono">{{ existingArticles }}</strong>
            <span>现有文章</span>
          </div>
          <div class="meter-item">
            <strong class="mono">{{ existingChars }}</strong>
            <span>现有字数</span>
          </div>
          <div class="meter-arrow">→</div>
          <div class="meter-item">
            <strong class="mono">{{ totalArticlesAfter }}</strong>
            <span>更新后文章</span>
          </div>
          <div class="meter-item">
            <strong class="mono">{{ totalCharsAfter }}</strong>
            <span>更新后字数</span>
          </div>
        </div>
        <span class="meter-limit" :class="{ over: overLimit }">
          上限 {{ MAX_TOTAL_ARTICLES }} 篇 / {{ MAX_TOTAL_CHARS.toLocaleString('zh-CN') }} 字
        </span>
      </div>

      <div class="corpus-actions">
        <span class="corpus-label">本次新增 {{ validArticles.length }} 篇 · {{ newChars }} 字</span>
        <div class="corpus-buttons">
          <el-button
            v-if="demoAppendTexts.length"
            size="small"
            @click="fillDemoAppend"
          >
            <el-icon><MagicStick /></el-icon>
            填入演示追加
          </el-button>
          <el-button size="small" @click="triggerUpload">
            <el-icon><Upload /></el-icon>
            上传 .txt
          </el-button>
        </div>
        <input
          ref="fileInput"
          type="file"
          accept=".txt,text/plain"
          multiple
          class="file-input"
          @change="handleFiles"
        />
      </div>

      <div class="append-list">
        <article
          v-for="(article, index) in articles"
          :key="index"
          class="append-item"
          :class="{ filled: article.trim().length >= MIN_ARTICLE_CHARS }"
        >
          <header class="append-item-head">
            <div class="append-item-title">
              <span class="article-no mono">{{ String(index + 1).padStart(2, '0') }}</span>
              <span>新文章 {{ index + 1 }}</span>
              <span
                v-if="article.trim().length && article.trim().length < MIN_ARTICLE_CHARS"
                class="article-warning"
              >
                至少 {{ MIN_ARTICLE_CHARS }} 字
              </span>
            </div>
            <div class="append-item-tools">
              <span class="article-count mono">{{ articleChars(article) }} 字</span>
              <el-button
                text
                circle
                size="small"
                class="remove-btn"
                :disabled="articles.length <= 1"
                @click="removeArticle(index)"
              >
                <el-icon><Close /></el-icon>
              </el-button>
            </div>
          </header>
          <el-input
            v-model="articles[index]"
            type="textarea"
            :autosize="{ minRows: 5, maxRows: 12 }"
            resize="vertical"
            :placeholder="
              index === 0
                ? '粘贴一篇新文章，它会和已有语料合并……'
                : '粘贴第 ' + (index + 1) + ' 篇新文章……'
            "
          />
        </article>
      </div>

      <el-button
        class="add-article"
        :disabled="articles.length >= MAX_APPEND_ARTICLES"
        @click="addArticle"
      >
        <el-icon><Plus /></el-icon>
        {{ articles.length >= MAX_APPEND_ARTICLES ? `每次最多 ${MAX_APPEND_ARTICLES} 篇` : '再加一篇新文章' }}
      </el-button>

      <el-alert
        v-if="errorInfo"
        class="append-alert submit-error"
        :title="errorInfo.title"
        type="error"
        show-icon
        :closable="false"
      >
        <p class="alert-text">{{ errorInfo.message }}</p>
      </el-alert>

      <div class="append-note">
        <el-icon><InfoFilled /></el-icon>
        <p>
          原文只保存在本机数据库中，用于后续增量更新，不会用于训练模型或公开分享。
          每次追加都会重新做一次语义分析；未配置 LLM_API_KEY 时，只有预置演示追加可用，自定义文章请先配置 Key。
        </p>
      </div>
    </template>

    <template #footer>
      <div class="append-footer">
        <span class="footer-hint">更新会替换当前档案的分析基线</span>
        <div class="footer-actions">
          <el-button :disabled="submitting" @click="close">取消</el-button>
          <el-button
            type="primary"
            :loading="submitting"
            :disabled="profile?.canAppend === false"
            @click="submit"
          >
            更新档案
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { metaApi, profileApi } from '../api';

const MIN_ARTICLE_CHARS = 20;
const MAX_APPEND_ARTICLES = 10;
const MAX_TOTAL_ARTICLES = 20;
const MAX_TOTAL_CHARS = 60000;

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  profile: { type: Object, default: null },
});

const emit = defineEmits(['update:modelValue', 'updated']);

const articles = ref(['']);
const fileInput = ref(null);
const submitting = ref(false);
const errorInfo = ref(null);
const demoAppendTexts = ref([]);

const existingArticles = computed(() => Number(props.profile?.stats?.articleCount) || 0);
const existingChars = computed(() => Number(props.profile?.stats?.charCount) || 0);
const validArticles = computed(() =>
  articles.value.map((text) => text.trim()).filter((text) => text.length >= MIN_ARTICLE_CHARS)
);
// 与档案 stats.charCount 口径一致：不计空白字符。
function articleChars(text) {
  return String(text || '').replace(/\s/g, '').length;
}

const newChars = computed(() =>
  validArticles.value.reduce((sum, text) => sum + articleChars(text), 0)
);
const totalArticlesAfter = computed(() => existingArticles.value + validArticles.value.length);
const totalCharsAfter = computed(() => existingChars.value + newChars.value);
const overLimit = computed(
  () =>
    totalArticlesAfter.value > MAX_TOTAL_ARTICLES ||
    totalCharsAfter.value > MAX_TOTAL_CHARS
);

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return;
    articles.value = [''];
    errorInfo.value = null;
    submitting.value = false;
    loadDemoAppend();
  }
);

async function loadDemoAppend() {
  demoAppendTexts.value = [];
  if (!props.profile?.name) return;
  try {
    const data = await metaApi.demo();
    demoAppendTexts.value = data.profileAppend?.[props.profile.name] || [];
  } catch {
    // 演示语料不可用时只隐藏快捷入口，不影响正常追加。
  }
}

function fillDemoAppend() {
  if (!demoAppendTexts.value.length) return;
  articles.value = demoAppendTexts.value.slice(0, MAX_APPEND_ARTICLES);
  errorInfo.value = null;
  ElMessage.success('已填入演示追加文章，可直接更新档案');
}

function addArticle() {
  if (articles.value.length >= MAX_APPEND_ARTICLES) return;
  articles.value.push('');
}

function removeArticle(index) {
  if (articles.value.length <= 1) return;
  articles.value.splice(index, 1);
}

function triggerUpload() {
  fileInput.value?.click();
}

async function handleFiles(event) {
  const files = Array.from(event.target.files || []);
  event.target.value = '';
  if (!files.length) return;

  const textFiles = files.filter(
    (file) => file.name.toLowerCase().endsWith('.txt') || file.type === 'text/plain'
  );
  if (textFiles.length !== files.length) {
    ElMessage.warning('只支持 .txt 文本文件');
  }
  if (!textFiles.length) return;

  const contents = [];
  for (const file of textFiles) {
    if (file.size > 1024 * 1024) {
      ElMessage.warning(`${file.name} 超过 1MB，已跳过`);
      continue;
    }
    try {
      const text = (await file.text()).trim();
      if (text) contents.push(text);
    } catch {
      ElMessage.warning(`${file.name} 读取失败`);
    }
  }
  if (!contents.length) return;

  let cursor = 0;
  for (const text of contents) {
    while (cursor < articles.value.length && articles.value[cursor].trim()) cursor += 1;
    if (cursor < articles.value.length) {
      articles.value[cursor] = text;
      cursor += 1;
    } else if (articles.value.length < MAX_APPEND_ARTICLES) {
      articles.value.push(text);
      cursor = articles.value.length;
    } else {
      ElMessage.warning(`每次最多追加 ${MAX_APPEND_ARTICLES} 篇，部分文件未导入`);
      break;
    }
  }
  ElMessage.success(`已导入 ${contents.length} 篇 .txt 文章`);
}

function handleVisibleChange(visible) {
  if (!visible && submitting.value) return;
  emit('update:modelValue', visible);
}

function close() {
  if (submitting.value) return;
  emit('update:modelValue', false);
}

function showError(error) {
  if (error.code === 'DEMO_NO_CACHE') {
    errorInfo.value = {
      title: '演示模式：这次追加没有预置缓存',
      message:
        '当前未配置 LLM_API_KEY，追加任意新语料都需要调用一次语义模型。请在 backend/.env 中配置 API Key 并重启服务后重试。',
    };
    return;
  }
  if (error.code === 'PROFILE_NO_SOURCE') {
    errorInfo.value = {
      title: '这份档案无法增量更新',
      message: error.message || '档案没有保存原始文章，请新建一份档案。',
    };
    return;
  }
  errorInfo.value = {
    title: '没有更新成功',
    message: error.message || '请稍后再试',
  };
}

async function submit() {
  if (submitting.value) return;
  errorInfo.value = null;

  if (props.profile?.canAppend === false) {
    showError({ code: 'PROFILE_NO_SOURCE' });
    return;
  }
  if (articles.value.some((text) => text.trim().length > 0 && text.trim().length < MIN_ARTICLE_CHARS)) {
    ElMessage.warning(`有文章太短了，请补到至少 ${MIN_ARTICLE_CHARS} 个字符，或清空该输入框`);
    return;
  }
  if (!validArticles.value.length) {
    ElMessage.warning('请至少提供 1 篇新文章');
    return;
  }
  if (totalArticlesAfter.value > MAX_TOTAL_ARTICLES) {
    ElMessage.warning(
      `追加后最多保存 ${MAX_TOTAL_ARTICLES} 篇文章，当前已有 ${existingArticles.value} 篇`
    );
    return;
  }
  if (totalCharsAfter.value > MAX_TOTAL_CHARS) {
    ElMessage.warning(
      `追加后总字数不能超过 ${MAX_TOTAL_CHARS} 个字符，请删减一些内容`
    );
    return;
  }

  submitting.value = true;
  try {
    const data = await profileApi.append(props.profile.id, validArticles.value);
    const meta = data.meta || {};
    ElMessage.success(
      `档案已更新：新增 ${meta.addedArticles || validArticles.value.length} 篇，当前共 ${meta.totalArticles || totalArticlesAfter.value} 篇`
    );
    emit('updated', data.profile);
    emit('update:modelValue', false);
  } catch (error) {
    showError(error);
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.append-dialog :deep(.el-dialog__body) {
  padding-top: 8px;
  padding-bottom: 2px;
}

.append-intro {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border: 1px dashed var(--line-strong);
  border-radius: 5px;
  background: rgba(255, 253, 248, 0.5);
}

.append-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: none;
  margin-top: 1px;
  padding: 3px 7px;
  border-radius: 3px;
  background: var(--vermilion-soft);
  color: var(--vermilion-dark);
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.append-intro p {
  color: var(--muted);
  font-size: 10.5px;
  line-height: 1.75;
}

.append-alert {
  margin-top: 14px;
}

.alert-text {
  margin-top: 3px;
  font-size: 11px;
  line-height: 1.7;
}

.append-meter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-top: 16px;
  padding: 11px 14px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: rgba(255, 253, 248, 0.4);
}

.meter-group {
  display: flex;
  align-items: baseline;
  gap: 17px;
}

.meter-item {
  display: flex;
  align-items: baseline;
  gap: 5px;
}

.meter-item strong {
  color: var(--ink-soft);
  font-family: var(--font-serif);
  font-size: 17px;
  font-weight: 600;
}

.meter-item span {
  color: var(--muted-soft);
  font-size: 9px;
}

.meter-arrow {
  color: var(--line-strong);
  font-size: 11px;
}

.meter-limit {
  flex: none;
  color: var(--muted-soft);
  font-size: 9px;
}

.meter-limit.over {
  color: var(--vermilion);
}

.corpus-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 16px;
}

.corpus-label {
  color: var(--muted-soft);
  font-size: 10px;
}

.corpus-buttons {
  display: flex;
  flex: none;
  gap: 6px;
}

.file-input {
  display: none;
}

.append-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
}

.append-item {
  padding: 11px 13px 13px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: rgba(255, 253, 248, 0.38);
  transition: border-color 0.2s ease;
}

.append-item:focus-within {
  border-color: var(--line-strong);
}

.append-item.filled {
  border-color: rgba(69, 100, 82, 0.24);
}

.append-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 7px;
}

.append-item-title {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--muted);
  font-size: 10.5px;
}

.article-no {
  color: var(--vermilion);
  font-size: 9.5px;
  font-weight: 600;
}

.article-warning {
  color: var(--gold);
  font-size: 9.5px;
}

.append-item-tools {
  display: flex;
  align-items: center;
  gap: 4px;
}

.article-count {
  color: var(--muted-soft);
  font-size: 9.5px;
}

.remove-btn {
  color: var(--muted-soft);
}

.remove-btn:hover {
  color: var(--vermilion);
}

.add-article {
  width: 100%;
  margin-top: 12px;
  border-style: dashed;
}

.submit-error {
  margin-top: 14px;
}

.append-note {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin-top: 14px;
  color: var(--muted-soft);
}

.append-note .el-icon {
  margin-top: 2px;
  flex: none;
  font-size: 12px;
}

.append-note p {
  font-size: 9.5px;
  line-height: 1.7;
}

.append-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.footer-hint {
  color: var(--muted-soft);
  font-size: 9.5px;
}

.footer-actions {
  display: flex;
  gap: 8px;
}

@media (max-width: 680px) {
  .append-intro {
    flex-direction: column;
    gap: 8px;
  }

  .append-meter {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .meter-group {
    flex-wrap: wrap;
    gap: 11px;
  }

  .corpus-actions,
  .append-footer {
    flex-direction: column;
    align-items: flex-start;
  }

  .corpus-buttons {
    flex-wrap: wrap;
  }

  .footer-actions {
    width: 100%;
  }

  .footer-actions .el-button {
    flex: 1;
  }
}
</style>
