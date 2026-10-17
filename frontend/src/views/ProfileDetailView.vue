<template>
  <div class="page-shell detail-page">
    <template v-if="loading">
      <div class="detail-skeleton">
        <el-skeleton :rows="8" animated />
      </div>
    </template>

    <template v-else-if="notFound">
      <section class="missing-state paper-card">
        <span class="seal missing-seal">缺</span>
        <h1>这份档案不在这里</h1>
        <p>它可能已经被删除，或者不属于当前账号。</p>
        <el-button type="primary" @click="router.replace({ name: 'profiles' })">
          返回档案列表
        </el-button>
      </section>
    </template>

    <template v-else-if="profile">
      <header class="detail-header">
        <div class="detail-heading">
          <button type="button" class="back-link" @click="router.push({ name: 'profiles' })">
            <el-icon><ArrowLeft /></el-icon>
            返回档案
          </button>
          <div class="title-row">
            <div>
              <p class="eyebrow">Archive · 笔迹档案</p>
              <h1 class="page-title">{{ profile.name }}</h1>
            </div>
            <span class="readonly-badge">
              <el-icon>
                <Upload v-if="canAppend" />
                <Lock v-else />
              </el-icon>
              {{ canAppend ? 'APPEND ONLY' : 'READ ONLY' }}
            </span>
          </div>
          <div class="meta-row">
            <span>{{ formatDate(profile.createdAt) }} 创建</span>
            <i v-if="stats.analyzedAt" />
            <span v-if="stats.analyzedAt">{{ formatDate(stats.analyzedAt) }} 最近分析</span>
            <i />
            <span>{{ stats.articleCount || 0 }} 篇历史文章</span>
            <i />
            <span>{{ stats.charCount || 0 }} 字语料</span>
          </div>
        </div>

        <div class="header-actions">
          <el-button size="large" @click="openRename">
            <el-icon><EditPen /></el-icon>
            改名
          </el-button>
          <el-button size="large" @click="articlesVisible = true">
            <el-icon><Document /></el-icon>
            查看文章
          </el-button>
          <el-button size="large" @click="appendVisible = true">
            <el-icon><Upload /></el-icon>
            继续投喂
          </el-button>
          <el-button size="large" @click="handleDelete">
            <el-icon><Delete /></el-icon>
            删除
          </el-button>
          <el-button type="primary" size="large" @click="useForWriting">
            <el-icon><Edit /></el-icon>
            用这份笔迹写作
          </el-button>
        </div>
      </header>

      <div class="readonly-banner">
        <el-icon><Upload /></el-icon>
        <p>
          档案的统计值和语义摘要不能手动编辑，但你可以继续投喂新文章，也可以随时查看已保存的原文。
          系统会把新文章和旧语料合并后重新提取，更新结果会立即用于后续生成与检测；表达变化很大时，也可以另建一份档案。
        </p>
        <span class="banner-tag">可追加 · 不可手改</span>
      </div>

      <div class="detail-grid">
        <div class="detail-left">
          <section class="summary-card paper-card">
            <span class="section-kicker">Voice summary</span>
            <blockquote>“{{ semantic.summary || '这份档案还没有摘要。' }}”</blockquote>
            <div class="summary-tags">
              <span v-for="move in signatureMoves" :key="move">{{ move }}</span>
            </div>
          </section>

          <section class="radar-card paper-card">
            <div class="card-head">
              <div>
                <span class="section-kicker">Language fingerprint</span>
                <h2>表达指纹</h2>
              </div>
              <span class="card-note">数值来自统计层与语义层</span>
            </div>
            <ProfileRadar :stats="stats" :semantic="semantic" :height="280" />
          </section>

          <section class="metrics-card paper-card">
            <div class="card-head">
              <div>
                <span class="section-kicker">Signals</span>
                <h2>关键指标</h2>
              </div>
            </div>
            <div class="metric-grid">
              <div v-for="metric in metricItems" :key="metric.label" class="metric-cell">
                <strong class="mono">{{ metric.value }}<small v-if="metric.unit">{{ metric.unit }}</small></strong>
                <span>{{ metric.label }}</span>
                <em>{{ metric.hint }}</em>
              </div>
            </div>
          </section>
        </div>

        <div class="detail-right">
          <section class="semantic-card paper-card">
            <div class="card-head">
              <div>
                <span class="section-kicker">Structure</span>
                <h2>怎么开头，怎么收尾</h2>
              </div>
            </div>
            <div class="semantic-list">
              <div v-for="(item, index) in structureItems" :key="item.label" class="semantic-item">
                <span class="semantic-no mono">{{ String(index + 1).padStart(2, '0') }}</span>
                <div>
                  <strong>{{ item.label }}</strong>
                  <p>{{ item.value || '暂无提取结果。' }}</p>
                </div>
              </div>
            </div>
          </section>

          <section class="semantic-card paper-card">
            <div class="card-head">
              <div>
                <span class="section-kicker">Habits</span>
                <h2>口头禅与表达习惯</h2>
              </div>
            </div>

            <div class="habit-block">
              <span class="habit-label">口头禅</span>
              <div v-if="catchphrases.length" class="phrase-cloud">
                <span v-for="phrase in catchphrases" :key="phrase">{{ phrase }}</span>
              </div>
              <p v-else class="habit-empty">没有捕捉到稳定的口头禅。</p>
            </div>

            <div class="habit-block">
              <span class="habit-label">比喻偏好</span>
              <p class="habit-text">{{ semantic.metaphorPreference || '暂无提取结果。' }}</p>
            </div>

            <div class="habit-block">
              <span class="habit-label">举例方式</span>
              <p class="habit-text">{{ semantic.exampleHabit || '暂无提取结果。' }}</p>
            </div>

            <div class="habit-block">
              <span class="habit-label">标志动作</span>
              <div v-if="signatureMoves.length" class="moves-list">
                <span v-for="(move, index) in signatureMoves" :key="move">
                  <i class="mono">{{ index + 1 }}</i>
                  {{ move }}
                </span>
              </div>
              <p v-else class="habit-empty">暂无提取结果。</p>
            </div>

            <div class="viewpoint-block">
              <div class="viewpoint-head">
                <span class="habit-label">观点强度</span>
                <b class="mono">{{ semantic.viewpointStrength ?? '—' }} / 100</b>
              </div>
              <div class="viewpoint-track">
                <span :style="{ width: `${semantic.viewpointStrength || 0}%` }" />
              </div>
              <p>数值越高，越习惯直接亮明判断；越低，越倾向陈述和留白。</p>
            </div>
          </section>

          <section class="semantic-card paper-card">
            <div class="card-head">
              <div>
                <span class="section-kicker">Vocabulary</span>
                <h2>高频用词</h2>
              </div>
              <span class="card-note">已过滤常见虚词</span>
            </div>
            <div v-if="highWords.length" class="word-list">
              <div v-for="word in highWords" :key="word.word" class="word-row">
                <span class="word-name">{{ word.word }}</span>
                <div class="word-track">
                  <span :style="{ width: `${wordWidth(word.count)}%` }" />
                </div>
                <span class="word-count mono">{{ word.count }}</span>
              </div>
            </div>
            <p v-else class="habit-empty">没有足够的高频词样本。</p>
          </section>
        </div>
      </div>

      <footer class="detail-cta">
        <div>
          <span class="section-kicker">Use this voice</span>
          <h2>下一次写作，从这份笔迹开始。</h2>
          <p>三要素生成会带上这份档案，生成后再做一次“像不像你”的检测。</p>
        </div>
        <el-button type="primary" size="large" @click="useForWriting">
          开始写作
          <el-icon><Right /></el-icon>
        </el-button>
      </footer>
    </template>

    <el-dialog v-model="renameVisible" title="档案改名" width="420px">
      <p class="dialog-hint">只能修改名称；想更新风格，请使用「继续投喂」追加文章。</p>
      <el-input
        v-model="renameName"
        maxlength="30"
        show-word-limit
        size="large"
        placeholder="新的档案名"
        @keyup.enter="confirmRename"
      />
      <template #footer>
        <el-button @click="renameVisible = false">取消</el-button>
        <el-button type="primary" :loading="renaming" @click="confirmRename">保存名称</el-button>
      </template>
    </el-dialog>

    <ProfileAppendDialog
      v-model="appendVisible"
      :profile="profile"
      @updated="handleAppended"
    />

    <ProfileArticlesDrawer v-model="articlesVisible" :profile="profile" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import ProfileRadar from '../components/ProfileRadar.vue';
import ProfileAppendDialog from '../components/ProfileAppendDialog.vue';
import ProfileArticlesDrawer from '../components/ProfileArticlesDrawer.vue';
import { profileApi } from '../api';
import { formatDate } from '../utils/format';

const route = useRoute();
const router = useRouter();

const profile = ref(null);
const loading = ref(true);
const notFound = ref(false);
const renameVisible = ref(false);
const renameName = ref('');
const renaming = ref(false);
const appendVisible = ref(false);
const articlesVisible = ref(false);

const stats = computed(() => profile.value?.stats || {});
const semantic = computed(() => profile.value?.semantic || {});
const canAppend = computed(() => profile.value?.canAppend !== false);
const catchphrases = computed(() => semantic.value.catchphrases || []);
const signatureMoves = computed(() => semantic.value.signatureMoves || []);
const highWords = computed(() => (stats.value.highFrequencyWords || []).slice(0, 10));
const maxWordCount = computed(() =>
  highWords.value.reduce((max, item) => Math.max(max, Number(item.count) || 0), 1)
);

const metricItems = computed(() => [
  {
    label: '平均句长',
    value: stats.value.avgSentenceLength ?? '—',
    unit: ' 字',
    hint: '一个句子的平均长度',
  },
  {
    label: '短句比例',
    value: stats.value.shortSentenceRatio ?? '—',
    unit: '%',
    hint: '15 字以内的句子',
  },
  {
    label: '句长波动',
    value: stats.value.sentenceLengthStd ?? '—',
    unit: '',
    hint: '越大越有起伏',
  },
  {
    label: '正式度',
    value: stats.value.formality ?? '—',
    unit: '%',
    hint: '书面表达的程度',
  },
  {
    label: '口语度',
    value: stats.value.colloquialism ?? '—',
    unit: '%',
    hint: '日常口语的浓度',
  },
  {
    label: '情绪浓度',
    value: stats.value.emotion ?? '—',
    unit: '%',
    hint: '情绪表达的密度',
  },
  {
    label: '比喻密度',
    value: stats.value.metaphorDensity ?? '—',
    unit: '%',
    hint: '比喻出现的频率',
  },
  {
    label: '个人经历',
    value: stats.value.personalExperienceRatio ?? '—',
    unit: '%',
    hint: '带亲身经历的句子',
  },
]);

const structureItems = computed(() => [
  { label: '开头习惯', value: semantic.value.openingStyle },
  { label: '推进方式', value: semantic.value.middleStyle },
  { label: '收尾方式', value: semantic.value.endingStyle },
]);

function wordWidth(count) {
  return Math.max(8, Math.round((Number(count) / maxWordCount.value) * 100));
}

async function load() {
  loading.value = true;
  notFound.value = false;
  try {
    const data = await profileApi.detail(route.params.id);
    profile.value = data.profile;
    if (route.query.created === '1') {
      ElMessage.success('档案已提取，可以开始写作了');
    }
  } catch (error) {
    if (error.status === 404) {
      notFound.value = true;
    } else {
      ElMessage.error(error.message || '档案加载失败');
    }
  } finally {
    loading.value = false;
  }
}

function useForWriting() {
  router.push({ name: 'write', query: { profile: profile.value.id } });
}

function handleAppended(updatedProfile) {
  if (updatedProfile) profile.value = updatedProfile;
}

function openRename() {
  renameName.value = profile.value.name;
  renameVisible.value = true;
}

async function confirmRename() {
  const name = renameName.value.trim();
  if (!name) {
    ElMessage.warning('档案名不能为空');
    return;
  }
  if (name === profile.value.name) {
    renameVisible.value = false;
    return;
  }
  renaming.value = true;
  try {
    const data = await profileApi.rename(profile.value.id, name);
    profile.value = data.profile;
    renameVisible.value = false;
    ElMessage.success('名称已更新');
  } catch (error) {
    ElMessage.error(error.message || '改名失败');
  } finally {
    renaming.value = false;
  }
}

async function handleDelete() {
  try {
    await ElMessageBox.confirm(
      `删除「${profile.value.name}」后，档案和保存的原文都无法恢复。用它生成过的文章会保留，但不再关联这份档案。`,
      '删除档案',
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
    await profileApi.remove(profile.value.id);
    ElMessage.success('档案已删除');
    router.replace({ name: 'profiles' });
  } catch (error) {
    ElMessage.error(error.message || '删除失败');
  }
}

onMounted(load);
</script>

<style scoped>
.detail-page {
  max-width: 1220px;
}

.detail-skeleton {
  padding: 40px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--paper-soft);
}

.missing-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 520px;
  margin: 12vh auto 0;
  padding: 50px;
  text-align: center;
}

.missing-seal {
  width: 48px;
  height: 48px;
  margin-bottom: 20px;
  opacity: 0.7;
}

.missing-state h1 {
  font-size: 27px;
}

.missing-state p {
  margin: 10px 0 22px;
  color: var(--muted);
  font-size: 12px;
}

.detail-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 30px;
  margin-bottom: 26px;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 20px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 11px;
  transition: color 0.2s ease;
}

.back-link:hover {
  color: var(--vermilion);
}

.title-row {
  display: flex;
  align-items: flex-end;
  gap: 16px;
}

.title-row .page-title {
  margin-top: 10px;
}

.readonly-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 9px;
  padding: 3px 8px;
  border: 1px solid var(--line-strong);
  border-radius: 3px;
  color: var(--muted);
  font-size: 8.5px;
  font-weight: 600;
  letter-spacing: 0.1em;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 13px;
  color: var(--muted-soft);
  font-size: 10.5px;
}

.meta-row i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--line-strong);
}

.header-actions {
  display: flex;
  gap: 8px;
  flex: none;
}

.readonly-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 26px;
  padding: 12px 16px;
  border: 1px dashed var(--line-strong);
  border-radius: 5px;
  background: rgba(255, 253, 248, 0.4);
  color: var(--muted);
}

.readonly-banner .el-icon {
  flex: none;
  font-size: 13px;
}

.readonly-banner p {
  font-size: 10.5px;
  line-height: 1.7;
}

.banner-tag {
  flex: none;
  margin-left: auto;
  padding: 2px 7px;
  border-radius: 3px;
  background: rgba(28, 27, 24, 0.06);
  color: var(--muted-soft);
  font-size: 8.5px;
  letter-spacing: 0.08em;
}

.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
  gap: 20px;
  align-items: start;
}

.detail-left,
.detail-right {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.summary-card {
  padding: 28px 28px 24px;
  background:
    radial-gradient(circle at 100% 0%, rgba(185, 65, 43, 0.07), transparent 48%),
    rgba(255, 253, 248, 0.72);
}

.summary-card blockquote {
  margin: 16px 0 0;
  color: var(--ink-soft);
  font-family: var(--font-serif);
  font-size: 20px;
  font-weight: 500;
  letter-spacing: -0.01em;
  line-height: 1.75;
}

.summary-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 20px;
}

.summary-tags span {
  padding: 3px 9px;
  border: 1px solid var(--line);
  border-radius: 3px;
  color: var(--muted);
  font-size: 9.5px;
}

.radar-card,
.metrics-card,
.semantic-card {
  padding: 24px 26px 22px;
}

.card-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 6px;
}

.card-head h2 {
  margin-top: 5px;
  font-size: 19px;
  letter-spacing: -0.02em;
}

.card-note {
  color: var(--muted-soft);
  font-size: 9px;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
  margin-top: 16px;
  border-top: 1px solid var(--line);
  border-left: 1px solid var(--line);
}

.metric-cell {
  padding: 14px 12px 12px;
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.metric-cell strong {
  display: block;
  color: var(--ink-soft);
  font-family: var(--font-serif);
  font-size: 22px;
  font-weight: 600;
  line-height: 1.1;
}

.metric-cell small {
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 400;
}

.metric-cell span {
  display: block;
  margin-top: 5px;
  color: var(--muted);
  font-size: 10px;
}

.metric-cell em {
  display: block;
  margin-top: 3px;
  color: var(--muted-soft);
  font-size: 8.5px;
  font-style: normal;
  line-height: 1.5;
}

.semantic-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-top: 14px;
}

.semantic-item {
  display: flex;
  gap: 12px;
  padding: 14px 0;
  border-top: 1px solid var(--line);
}

.semantic-item:first-child {
  border-top: none;
}

.semantic-no {
  flex: none;
  padding-top: 2px;
  color: var(--vermilion);
  font-size: 9px;
  font-weight: 600;
}

.semantic-item strong {
  display: block;
  font-family: var(--font-serif);
  font-size: 12.5px;
}

.semantic-item p {
  margin-top: 4px;
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.8;
}

.habit-block {
  margin-top: 16px;
}

.habit-label {
  display: block;
  margin-bottom: 7px;
  color: var(--muted-soft);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.12em;
}

.phrase-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.phrase-cloud span {
  padding: 4px 10px;
  border: 1px solid rgba(185, 65, 43, 0.18);
  border-radius: 3px;
  background: var(--vermilion-soft);
  color: var(--vermilion-dark);
  font-family: var(--font-serif);
  font-size: 11.5px;
}

.habit-text,
.habit-empty {
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.8;
}

.habit-empty {
  color: var(--muted-soft);
}

.moves-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.moves-list > span {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.7;
}

.moves-list i {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 17px;
  height: 17px;
  margin-top: 1px;
  border: 1px solid var(--line);
  border-radius: 50%;
  color: var(--muted-soft);
  font-size: 8px;
  font-style: normal;
}

.viewpoint-block {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}

.viewpoint-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.viewpoint-head b {
  color: var(--ink-soft);
  font-size: 12px;
}

.viewpoint-track {
  height: 4px;
  margin-top: 8px;
  overflow: hidden;
  border-radius: 4px;
  background: rgba(28, 27, 24, 0.08);
}

.viewpoint-track span {
  display: block;
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--gold), var(--vermilion));
}

.viewpoint-block p {
  margin-top: 7px;
  color: var(--muted-soft);
  font-size: 9.5px;
  line-height: 1.6;
}

.word-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
  margin-top: 15px;
}

.word-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.word-name {
  width: 74px;
  flex: none;
  overflow: hidden;
  color: var(--ink-soft);
  font-family: var(--font-serif);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.word-track {
  flex: 1;
  height: 3px;
  overflow: hidden;
  border-radius: 3px;
  background: rgba(28, 27, 24, 0.07);
}

.word-track span {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: rgba(185, 65, 43, 0.55);
}

.word-count {
  width: 18px;
  color: var(--muted-soft);
  font-size: 9px;
  text-align: right;
}

.detail-cta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 30px;
  margin-top: 30px;
  padding: 30px 34px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background:
    radial-gradient(circle at 0% 100%, rgba(185, 65, 43, 0.08), transparent 40%),
    rgba(255, 253, 248, 0.55);
}

.detail-cta h2 {
  margin-top: 5px;
  font-size: 22px;
  letter-spacing: -0.025em;
}

.detail-cta p {
  margin-top: 7px;
  color: var(--muted);
  font-size: 11px;
}

.dialog-hint {
  margin-bottom: 14px;
  color: var(--muted);
  font-size: 11px;
}

@media (max-width: 980px) {
  .detail-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }

  .header-actions {
    flex-wrap: wrap;
  }
}

@media (max-width: 620px) {
  .title-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .readonly-badge {
    margin-bottom: 0;
  }

  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .header-actions {
    width: 100%;
  }

  .header-actions .el-button {
    flex: 1;
    margin-left: 0;
  }

  .detail-cta {
    flex-direction: column;
    align-items: flex-start;
  }

  .readonly-banner {
    align-items: flex-start;
  }

  .banner-tag {
    display: none;
  }
}
</style>
