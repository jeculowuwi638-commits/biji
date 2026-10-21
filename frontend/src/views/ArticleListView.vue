<template>
  <div class="page-shell">
    <header class="page-header">
      <div>
        <p class="eyebrow">Articles · 我的文章</p>
        <h1 class="page-title">写过的，<br />都留在这里。</h1>
        <p class="page-subtitle">
          写作台里点过“保存文章”的稿子都会出现在这里。可以继续打开编辑，也可以回来看一眼当时写下的版本。
        </p>
      </div>
      <div class="header-actions">
        <el-button type="primary" size="large" @click="router.push({ name: 'write' })">
          <el-icon><EditPen /></el-icon>
          开始写作
        </el-button>
      </div>
    </header>

    <section v-if="loading" class="article-grid">
      <div v-for="item in 3" :key="item" class="skeleton-card paper-card">
        <el-skeleton :rows="4" animated />
      </div>
    </section>

    <template v-else-if="articles.length">
      <div class="archive-bar">
        <div class="archive-stats">
          <div class="archive-stat">
            <strong class="mono">{{ articles.length }}</strong>
            <span>篇文章</span>
          </div>
          <div class="archive-stat">
            <strong class="mono">{{ totalChars.toLocaleString('zh-CN') }}</strong>
            <span>字正文</span>
          </div>
        </div>
        <span class="readonly-note">
          <el-icon><DocumentChecked /></el-icon>
          保存后可继续编辑
        </span>
      </div>

      <div class="article-grid">
        <article
          v-for="article in articles"
          :key="article.id"
          class="article-card paper-card"
          @click="openDetail(article)"
        >
          <header class="card-top">
            <span class="platform-chip">{{ article.platformLabel }}</span>
            <span class="card-date mono">{{ formatDate(article.updatedAt) }}</span>
          </header>
          <h3>{{ article.title }}</h3>
          <p class="card-preview">{{ article.preview || '还没有正文。' }}</p>
          <div class="card-meta">
            <span>{{ article.charCount }} 字</span>
            <i />
            <span>{{ article.profileName || '不使用档案' }}</span>
          </div>
          <footer class="card-actions" @click.stop>
            <el-button text size="small" @click="editArticle(article)">
              <el-icon><EditPen /></el-icon>
              继续编辑
            </el-button>
            <el-button text size="small" type="danger" @click="removeArticle(article)">
              <el-icon><Delete /></el-icon>
              删除
            </el-button>
          </footer>
        </article>
      </div>
    </template>

    <section v-else class="empty-state paper-card">
      <span class="empty-seal seal">稿</span>
      <p class="eyebrow plain">No saved article yet</p>
      <h2>还没有保存过文章</h2>
      <p>
        去写作台生成或手写一篇，改到满意后点“保存文章”。
        保存后的稿子会按更新时间排在这里。
      </p>
      <el-button type="primary" size="large" @click="router.push({ name: 'write' })">
        去写作台
      </el-button>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { articleApi } from '../api';
import { formatDate } from '../utils/format';

const router = useRouter();
const articles = ref([]);
const loading = ref(true);

const totalChars = computed(() =>
  articles.value.reduce((sum, article) => sum + (Number(article.charCount) || 0), 0)
);

async function load() {
  loading.value = true;
  try {
    const data = await articleApi.list();
    articles.value = data.articles || [];
  } catch (error) {
    ElMessage.error(error.message || '文章加载失败');
  } finally {
    loading.value = false;
  }
}

function openDetail(article) {
  router.push({ name: 'article-detail', params: { id: article.id } });
}

function editArticle(article) {
  router.push({ name: 'write', query: { article: article.id } });
}

async function removeArticle(article) {
  try {
    await ElMessageBox.confirm(
      `删除「${article.title}」后无法恢复。`,
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
    await articleApi.remove(article.id);
    articles.value = articles.value.filter((item) => item.id !== article.id);
    ElMessage.success('文章已删除');
  } catch (error) {
    ElMessage.error(error.message || '删除失败');
  }
}

onMounted(load);
</script>

<style scoped>
.header-actions {
  display: flex;
  gap: 10px;
  flex: none;
}

.archive-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 20px;
  padding: 14px 20px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: rgba(255, 253, 248, 0.45);
}

.archive-stats {
  display: flex;
  gap: 34px;
}

.archive-stat {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.archive-stat strong {
  color: var(--ink-soft);
  font-family: var(--font-serif);
  font-size: 18px;
  font-weight: 600;
}

.archive-stat span {
  color: var(--muted-soft);
  font-size: 10px;
}

.readonly-note {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--muted-soft);
  font-size: 9.5px;
}

.article-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
  gap: 14px;
}

.skeleton-card {
  padding: 22px;
}

.article-card {
  display: flex;
  flex-direction: column;
  min-height: 240px;
  padding: 20px 20px 14px;
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.article-card:hover {
  border-color: var(--line-strong);
  transform: translateY(-2px);
  box-shadow: 0 12px 30px rgba(28, 27, 24, 0.055);
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.platform-chip {
  padding: 2px 7px;
  border: 1px solid var(--line);
  border-radius: 3px;
  color: var(--muted);
  font-size: 8.5px;
}

.card-date {
  color: var(--muted-soft);
  font-size: 9px;
}

.article-card h3 {
  margin-top: 13px;
  font-family: var(--font-serif);
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.45;
}

.card-preview {
  display: -webkit-box;
  margin-top: 9px;
  overflow: hidden;
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.75;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.card-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: auto;
  padding-top: 14px;
  color: var(--muted-soft);
  font-size: 9px;
}

.card-meta i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--line-strong);
}

.card-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--line);
}

.card-actions .el-button {
  padding: 0;
  font-size: 9.5px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 78px 34px 72px;
  text-align: center;
}

.empty-state h2 {
  margin-top: 14px;
  font-size: 27px;
}

.empty-state > p:not(.eyebrow) {
  max-width: 430px;
  margin: 12px 0 24px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.9;
}

@media (max-width: 720px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 18px;
  }

  .archive-bar {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .article-grid {
    grid-template-columns: 1fr;
  }
}
</style>
