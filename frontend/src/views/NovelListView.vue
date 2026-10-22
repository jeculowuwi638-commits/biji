<template>
  <div class="page-shell novel-page">
    <WritingModeSwitch mode="novel" />

    <header class="page-header">
      <div>
        <p class="eyebrow">Novel desk · 小说续写</p>
        <h1 class="page-title">把长篇，<br />接着写下去。</h1>
        <p class="page-subtitle">
          用你的笔迹续写，同时记住人物知道什么、故事走到哪、哪些伏笔还没回收。
          每次给出 2–3 个候选稿，先查一致性，再决定要不要成为下一章。
        </p>
      </div>
      <div class="header-actions">
        <el-button
          v-if="demoNovel"
          size="large"
          :loading="demoLoading"
          @click="createDemo"
        >
          <el-icon><MagicStick /></el-icon>
          载入演示作品
        </el-button>
        <el-button type="primary" size="large" @click="openCreate">
          <el-icon><Plus /></el-icon>
          新建小说
        </el-button>
      </div>
    </header>

    <section v-if="loading" class="novel-grid">
      <div v-for="item in 3" :key="item" class="skeleton-card paper-card">
        <el-skeleton :rows="5" animated />
      </div>
    </section>

    <template v-else-if="novels.length">
      <div class="archive-bar">
        <div class="archive-stats">
          <div class="archive-stat">
            <strong class="mono">{{ novels.length }}</strong>
            <span>部作品</span>
          </div>
          <div class="archive-stat">
            <strong class="mono">{{ totalChapters }}</strong>
            <span>章正文</span>
          </div>
          <div class="archive-stat">
            <strong class="mono">{{ analyzedCount }}</strong>
            <span>份故事记忆卡</span>
          </div>
        </div>
        <span class="readonly-note">
          <el-icon><Lock /></el-icon>
          原始章节只读 · 续写只追加
        </span>
      </div>

      <div class="novel-grid">
        <article
          v-for="novel in novels"
          :key="novel.id"
          class="novel-card paper-card"
          @click="openNovel(novel)"
        >
          <div class="card-ribbon">
            <span class="book-mark">卷</span>
            <span class="card-date mono">{{ formatDate(novel.updatedAt) }}</span>
          </div>

          <h2>{{ novel.title }}</h2>
          <p class="card-description">
            {{ novel.description || '还没有写作品简介。打开后可以补充题材、人物和不能写崩的设定。' }}
          </p>

          <div class="card-tags">
            <span>{{ novel.narratorLabel }}</span>
            <span v-if="novel.strictSettings" class="strict-tag">严格守设定</span>
            <span v-if="novel.styleProfile" class="profile-tag">
              {{ novel.styleProfile.name }}
            </span>
          </div>

          <div class="chapter-line">
            <template v-if="novel.latestChapter">
              <span class="latest-label">最新</span>
              <strong>
                {{ novel.latestChapter.orderLabel }} · {{ chapterDisplayTitle(novel.latestChapter) }}
              </strong>
            </template>
            <template v-else>
              <span class="latest-label empty">待导入</span>
              <strong>还没有章节正文</strong>
            </template>
          </div>

          <footer class="card-footer">
            <div class="card-meta">
              <span>{{ novel.chapterCount }} 章</span>
              <i />
              <span :class="novel.bible?.analyzed ? 'bible-ready' : 'bible-pending'">
                {{ novel.bible?.analyzed ? '记忆卡已建' : '待分析' }}
              </span>
            </div>
            <div class="card-actions" @click.stop>
              <el-button text size="small" @click="openNovel(novel)">
                打开工作台
                <el-icon><ArrowRight /></el-icon>
              </el-button>
              <el-button text size="small" type="danger" @click="removeNovel(novel)">
                删除
              </el-button>
            </div>
          </footer>
        </article>

        <button type="button" class="new-novel-tile" @click="openCreate">
          <span class="new-tile-mark">+</span>
          <strong>新建另一部作品</strong>
          <p>导入已有章节，先让模型读懂故事，再从下一章继续。</p>
        </button>
      </div>
    </template>

    <section v-else class="empty-state paper-card">
      <span class="empty-seal seal">说</span>
      <p class="eyebrow plain">No novel yet</p>
      <h2>还没有开始一部长篇</h2>
      <p>
        先建一部作品，导入 2–3 章正文。系统会提取人物、关系、时间线和未回收伏笔，
        再用你绑定的笔迹续写下一章。
      </p>
      <div class="empty-actions">
        <el-button type="primary" size="large" @click="openCreate">
          新建第一部小说
        </el-button>
        <el-button v-if="demoNovel" size="large" :loading="demoLoading" @click="createDemo">
          用《{{ demoNovel.title }}》演示
        </el-button>
      </div>
      <div class="empty-hints">
        <span>先建故事记忆</span>
        <i />
        <span>一次给 2–3 个候选</span>
        <i />
        <span>不自动覆盖正文</span>
      </div>
    </section>

    <section class="how-card">
      <div class="how-copy">
        <span class="section-kicker">How it works</span>
        <h2>长篇不是一次性生成</h2>
        <p>
          小说工作台把“写下去”拆成三步：先让模型读懂已有章节，形成可持续修正的故事记忆卡；
          再按你的笔迹和本章要求生成候选；最后逐条检查人物、时间线、世界观和伏笔是否冲突。
          候选稿只有在你确认后，才会作为新章节追加。
        </p>
      </div>
      <div class="how-steps">
        <div class="how-step">
          <span class="mono">01</span>
          <strong>记住故事</strong>
          <p>自动提取人物与关系、地点、世界规则、时间线、事件和未回收伏笔。</p>
        </div>
        <div class="how-step">
          <span class="mono">02</span>
          <strong>按笔迹续写</strong>
          <p>结合文风档案、故事记忆、最近章节和本章要求，生成 2–3 个方向不同的候选。</p>
        </div>
        <div class="how-step">
          <span class="mono">03</span>
          <strong>查完再采用</strong>
          <p>指出具体段落里的设定冲突和文风偏离，采纳时才追加为新章节。</p>
        </div>
      </div>
    </section>

    <NovelFormDialog
      v-model="formVisible"
      mode="create"
      :profiles="profiles"
      :narrators="narrators"
      :submitting="creating"
      @submit="createNovel"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import WritingModeSwitch from '../components/WritingModeSwitch.vue';
import NovelFormDialog from '../components/NovelFormDialog.vue';
import { metaApi, novelApi, profileApi } from '../api';
import { chapterDisplayTitle, formatDate } from '../utils/format';

const router = useRouter();
const novels = ref([]);
const profiles = ref([]);
const narrators = ref([]);
const demoNovel = ref(null);
const loading = ref(true);
const formVisible = ref(false);
const creating = ref(false);
const demoLoading = ref(false);

const totalChapters = computed(() =>
  novels.value.reduce((sum, novel) => sum + (Number(novel.chapterCount) || 0), 0)
);
const analyzedCount = computed(
  () => novels.value.filter((novel) => novel.bible?.analyzed).length
);

async function load() {
  loading.value = true;
  try {
    const [novelData, profileData, meta, demo] = await Promise.all([
      novelApi.list(),
      profileApi.list().catch(() => ({ profiles: [] })),
      novelApi.meta().catch(() => ({ narrators: [] })),
      metaApi.demo().catch(() => null),
    ]);
    novels.value = novelData.novels || [];
    profiles.value = profileData.profiles || [];
    narrators.value = meta.narrators || [];
    demoNovel.value = demo?.novel || null;
  } catch (error) {
    ElMessage.error(error.message || '作品列表加载失败');
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  formVisible.value = true;
}

function openNovel(novel) {
  router.push({ name: 'novel-workspace', params: { id: novel.id } });
}

async function createNovel(payload) {
  if (creating.value) return;
  creating.value = true;
  try {
    const data = await novelApi.create(payload);
    formVisible.value = false;
    ElMessage.success('作品已创建，下一步导入章节');
    router.push({ name: 'novel-workspace', params: { id: data.novel.id } });
  } catch (error) {
    ElMessage.error(error.message || '创建失败');
  } finally {
    creating.value = false;
  }
}

async function createDemo() {
  if (!demoNovel.value || demoLoading.value) return;
  const existing = novels.value.find((novel) => novel.title === demoNovel.value.title);
  if (existing) {
    openNovel(existing);
    return;
  }

  demoLoading.value = true;
  try {
    const created = await novelApi.create({
      title: demoNovel.value.title,
      description: demoNovel.value.description,
      narrator: demoNovel.value.narrator,
      strictSettings: demoNovel.value.strictSettings,
    });
    await novelApi.addChapters(created.novel.id, demoNovel.value.chapters);
    ElMessage.success('演示作品与三章正文已创建，正在打开');
    router.push({
      name: 'novel-workspace',
      params: { id: created.novel.id },
      query: { analyze: '1' },
    });
  } catch (error) {
    ElMessage.error(error.message || '演示作品创建失败');
  } finally {
    demoLoading.value = false;
  }
}

async function removeNovel(novel) {
  try {
    await ElMessageBox.confirm(
      `删除《${novel.title}》会同时删除章节和故事记忆卡，且无法恢复。`,
      '删除作品',
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
    await novelApi.remove(novel.id);
    novels.value = novels.value.filter((item) => item.id !== novel.id);
    ElMessage.success('作品已删除');
  } catch (error) {
    ElMessage.error(error.message || '删除失败');
  }
}

onMounted(load);
</script>

<style scoped>
.novel-page {
  max-width: 1280px;
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
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

.novel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(330px, 1fr));
  gap: 15px;
}

.new-novel-tile {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  min-height: 290px;
  padding: 28px;
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius);
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.new-novel-tile:hover {
  border-color: rgba(185, 65, 43, 0.38);
  background: rgba(255, 253, 248, 0.35);
}

.new-tile-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin-bottom: 15px;
  border: 1px solid var(--line-strong);
  border-radius: 50%;
  color: var(--muted);
  font-family: var(--font-serif);
  font-size: 19px;
  font-weight: 400;
}

.new-novel-tile:hover .new-tile-mark {
  border-color: rgba(185, 65, 43, 0.4);
  color: var(--vermilion);
}

.new-novel-tile strong {
  font-family: var(--font-serif);
  font-size: 17px;
  font-weight: 600;
}

.new-novel-tile p {
  max-width: 300px;
  margin-top: 7px;
  color: var(--muted-soft);
  font-size: 10px;
  line-height: 1.75;
}

.skeleton-card {
  padding: 22px;
}

.novel-card {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 290px;
  padding: 20px 21px 14px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.novel-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 34px;
  width: 1px;
  height: 100%;
  background: rgba(185, 65, 43, 0.11);
  pointer-events: none;
}

.novel-card:hover {
  border-color: var(--line-strong);
  transform: translateY(-2px);
  box-shadow: 0 14px 32px rgba(28, 27, 24, 0.06);
}

.card-ribbon {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.book-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 25px;
  height: 25px;
  border: 1px solid rgba(185, 65, 43, 0.28);
  border-radius: 3px;
  color: var(--vermilion);
  font-family: var(--font-serif);
  font-size: 12px;
}

.card-date {
  color: var(--muted-soft);
  font-size: 9px;
}

.novel-card h2 {
  margin-top: 13px;
  padding-left: 13px;
  font-family: var(--font-serif);
  font-size: 25px;
  font-weight: 600;
  letter-spacing: -0.025em;
  line-height: 1.35;
}

.card-description {
  display: -webkit-box;
  margin-top: 8px;
  padding-left: 13px;
  overflow: hidden;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.75;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 11px;
  padding-left: 13px;
}

.card-tags span {
  padding: 1px 6px;
  border: 1px solid var(--line);
  border-radius: 2px;
  color: var(--muted-soft);
  font-size: 8px;
}

.card-tags .strict-tag {
  border-color: rgba(69, 100, 82, 0.22);
  color: var(--jade);
}

.card-tags .profile-tag {
  border-color: rgba(155, 123, 66, 0.22);
  color: var(--gold);
}

.chapter-line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  margin-top: auto;
  padding: 12px 0 10px 13px;
}

.latest-label {
  flex: none;
  padding: 1px 5px;
  border-radius: 2px;
  background: rgba(185, 65, 43, 0.07);
  color: var(--vermilion);
  font-size: 8px;
}

.latest-label.empty {
  background: rgba(28, 27, 24, 0.05);
  color: var(--muted-soft);
}

.chapter-line strong {
  overflow: hidden;
  color: var(--ink-soft);
  font-family: var(--font-serif);
  font-size: 10.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-left: 13px;
  padding-top: 8px;
  border-top: 1px solid var(--line);
}

.card-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  color: var(--muted-soft);
  font-size: 8.5px;
}

.card-meta i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--line-strong);
}

.bible-ready {
  color: var(--jade);
}

.bible-pending {
  color: var(--gold);
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.card-actions .el-button {
  padding: 0;
  font-size: 9px;
}

.card-actions .el-button .el-icon {
  margin-left: 2px;
  font-size: 10px;
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
  max-width: 470px;
  margin: 12px 0 24px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.9;
}

.empty-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}

.empty-hints {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 22px;
  color: var(--muted-soft);
  font-size: 9px;
}

.empty-hints i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--line-strong);
}

.how-card {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.4fr);
  gap: 44px;
  margin-top: 46px;
  padding: 34px;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.how-copy h2 {
  margin-top: 6px;
  font-size: 24px;
}

.how-copy p {
  margin-top: 12px;
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.9;
}

.how-steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.how-step {
  padding-left: 12px;
  border-left: 1px solid var(--line);
}

.how-step .mono {
  color: var(--vermilion);
  font-size: 9px;
}

.how-step strong {
  display: block;
  margin-top: 7px;
  font-family: var(--font-serif);
  font-size: 13px;
  font-weight: 600;
}

.how-step p {
  margin-top: 6px;
  color: var(--muted-soft);
  font-size: 9.5px;
  line-height: 1.7;
}

@media (max-width: 960px) {
  .how-card {
    grid-template-columns: 1fr;
    gap: 24px;
  }
}

@media (max-width: 720px) {
  .header-actions {
    width: 100%;
  }

  .header-actions .el-button {
    flex: 1;
  }

  .archive-bar {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .novel-grid {
    grid-template-columns: 1fr;
  }

  .how-steps {
    grid-template-columns: 1fr;
  }

  .card-footer {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
