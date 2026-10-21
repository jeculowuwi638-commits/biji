<template>
  <div class="page-shell article-page">
    <section v-if="loading" class="detail-card paper-card">
      <el-skeleton :rows="8" animated />
    </section>

    <template v-else-if="article">
      <header class="article-header">
        <div class="article-heading">
          <button type="button" class="back-link" @click="router.push({ name: 'articles' })">
            <el-icon><ArrowLeft /></el-icon>
            我的文章
          </button>
          <span class="section-kicker">Saved draft</span>
          <h1 class="article-title">{{ article.title }}</h1>
          <div class="article-meta">
            <span>{{ article.platformLabel }}</span>
            <i />
            <span>{{ article.profileName || '不使用档案' }}</span>
            <i />
            <span>{{ article.charCount }} 字</span>
            <i />
            <span>更新于 {{ formatDateTime(article.updatedAt) }}</span>
          </div>
        </div>

        <div class="article-actions">
          <el-button size="small" @click="copyContent">
            <el-icon><CopyDocument /></el-icon>
            复制
          </el-button>
          <el-button type="primary" size="small" @click="editArticle">
            <el-icon><EditPen /></el-icon>
            继续编辑
          </el-button>
          <el-button size="small" type="danger" plain @click="removeArticle">
            <el-icon><Delete /></el-icon>
            删除
          </el-button>
        </div>
      </header>

      <article class="detail-card paper-card">
        <div class="article-content content-prose">
          <p
            v-for="(paragraph, index) in paragraphs"
            :key="index"
          >{{ paragraph }}</p>
        </div>
        <footer class="article-foot">
          <span class="mono">{{ article.charCount }} 字</span>
          <span>创建于 {{ formatDateTime(article.createdAt) }}</span>
        </footer>
      </article>
    </template>

    <section v-else class="detail-card paper-card error-state">
      <span class="seal">失</span>
      <h2>没有找到这篇文章</h2>
      <p>{{ errorMessage || '它可能已经被删除，或不属于当前账号。' }}</p>
      <el-button type="primary" @click="router.push({ name: 'articles' })">
        回到我的文章
      </el-button>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { articleApi } from '../api';
import { formatDateTime } from '../utils/format';

const route = useRoute();
const router = useRouter();
const article = ref(null);
const loading = ref(true);
const errorMessage = ref('');

const paragraphs = computed(() =>
  String(article.value?.content || '')
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
);

async function load() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const data = await articleApi.detail(route.params.id);
    article.value = data.article;
  } catch (error) {
    errorMessage.value = error.message || '';
    article.value = null;
  } finally {
    loading.value = false;
  }
}

function editArticle() {
  if (!article.value) return;
  router.push({ name: 'write', query: { article: article.value.id } });
}

async function copyContent() {
  if (!article.value?.content) return;
  try {
    await navigator.clipboard.writeText(article.value.content);
    ElMessage.success('正文已复制');
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = article.value.content;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    ElMessage.success('正文已复制');
  }
}

async function removeArticle() {
  if (!article.value) return;
  try {
    await ElMessageBox.confirm(
      `删除「${article.value.title}」后无法恢复。`,
      '删除文章',
      {
        confirmButtonText: '确认删除',
        cancelButtonText: '再想想',
        type: 'warning',
      }
    );
  } catch {
    return;
  }

  try {
    await articleApi.remove(article.value.id);
    ElMessage.success('文章已删除');
    router.replace({ name: 'articles' });
  } catch (error) {
    ElMessage.error(error.message || '删除失败');
  }
}

onMounted(load);
</script>

<style scoped>
.article-page {
  max-width: 900px;
  padding-top: 44px;
}

.article-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 28px;
  margin-bottom: 20px;
}

.article-heading {
  min-width: 0;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 18px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 10px;
  cursor: pointer;
  transition: color 0.2s ease;
}

.back-link:hover {
  color: var(--vermilion);
}

.article-title {
  margin-top: 10px;
  color: var(--ink);
  font-family: var(--font-serif);
  font-size: clamp(28px, 4vw, 42px);
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1.3;
}

.article-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
  color: var(--muted-soft);
  font-size: 10px;
}

.article-meta i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--line-strong);
}

.article-actions {
  display: flex;
  flex: none;
  gap: 7px;
}

.detail-card {
  padding: 34px 38px 24px;
}

.article-content {
  font-family: var(--font-serif);
  font-size: 16.5px;
  line-height: 2.1;
}

.article-content p + p {
  margin-top: 1.1em;
}

.article-content p {
  white-space: pre-wrap;
}

.article-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 28px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
  color: var(--muted-soft);
  font-size: 9px;
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 70px 30px;
  text-align: center;
}

.error-state h2 {
  margin-top: 16px;
  font-size: 25px;
}

.error-state p {
  margin: 10px 0 22px;
  color: var(--muted);
  font-size: 12px;
}

@media (max-width: 760px) {
  .article-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .article-actions {
    flex-wrap: wrap;
  }

  .detail-card {
    padding: 24px 20px 18px;
  }

  .article-content {
    font-size: 16px;
  }

  .article-foot {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
}
</style>
