<template>
  <div class="page-shell write-page">
    <header class="write-header">
      <div>
        <p class="eyebrow">创作 · 三要素生成</p>
        <h1 class="page-title">写什么，用谁的笔迹，<br />要不要微调。</h1>
        <p class="page-subtitle">
          三要素确定后，笔迹会带着你的档案写；写完之后，再做一次“像不像你”的检测，必要时按问题重写。
        </p>
      </div>

      <div class="header-side">
        <el-button v-if="demoData" size="small" @click="applyDemo">
          <el-icon><MagicStick /></el-icon>
          载入演示设置
        </el-button>
      </div>
    </header>

    <div class="write-layout">
      <aside class="control-panel">
        <section class="control-card paper-card">
          <div class="element-head">
            <span class="element-no mono">01</span>
            <div>
              <h2>写什么</h2>
              <p>一个主题、一件事，或一段素材。</p>
            </div>
            <span class="char-counter mono">{{ topic.length }} / 5000</span>
          </div>
          <el-input
            v-model="topic"
            type="textarea"
            :autosize="{ minRows: 5, maxRows: 10 }"
            maxlength="5000"
            resize="none"
            placeholder="比如：写一件最近发生的小事——我开始把下班后的两个小时留给写作，也拒绝了几场不想去的饭局。写给那些总觉得时间被别人占满的人。"
          />
          <div class="topic-hint">
            <span>带一点具体场景、对象或情绪，会比一句宽泛的题目更好写。</span>
            <el-button
              v-if="demoData"
              text
              size="small"
              class="demo-topic-btn"
              @click="topic = demoData.writing.topic"
            >
              用演示主题
            </el-button>
          </div>
        </section>

        <section class="control-card paper-card">
          <div class="element-head">
            <span class="element-no mono">02</span>
            <div>
              <h2>用哪份笔迹</h2>
              <p>选一份笔迹档案，或退回普通 AI。</p>
            </div>
          </div>

          <div class="profile-options">
            <button
              type="button"
              class="profile-option none-option"
              :class="{ active: selectedProfileId === null }"
              @click="selectedProfileId = null"
            >
              <span class="radio-dot" />
              <div class="option-copy">
                <div class="option-title">
                  <strong>不使用档案</strong>
                  <span class="option-tag">对照组</span>
                </div>
                <p>普通 AI 直接写。检测时只跑通用 AI 味，不计算个人贴合度。</p>
              </div>
            </button>

            <button
              v-for="profile in profiles"
              :key="profile.id"
              type="button"
              class="profile-option"
              :class="{ active: selectedProfileId === profile.id }"
              @click="selectedProfileId = profile.id"
            >
              <span class="radio-dot" />
              <div class="option-copy">
                <div class="option-title">
                  <strong>{{ profile.name }}</strong>
                  <span class="option-meta mono">
                    {{ profile.stats?.avgSentenceLength || '—' }} 字/句
                  </span>
                </div>
                <p>
                  {{ profile.semantic?.summary || '表达档案' }}
                </p>
                <div v-if="profile.semantic?.catchphrases?.length" class="option-phrases">
                  <span v-for="phrase in profile.semantic.catchphrases.slice(0, 3)" :key="phrase">
                    {{ phrase }}
                  </span>
                </div>
              </div>
            </button>
          </div>

          <div v-if="!profiles.length" class="no-profile-note">
            还没有档案。先去
            <router-link :to="{ name: 'profile-create' }">提取一份</router-link>
            ，或直接使用“不使用档案”作为对照组。
          </div>
        </section>

        <section class="control-card paper-card">
          <div class="element-head">
            <span class="element-no mono">03</span>
            <div>
              <h2>要不要微调</h2>
              <p>在档案基础上，只调这一次。</p>
            </div>
            <el-switch v-model="tuningEnabled" />
          </div>

          <TuningSliders v-if="tuningEnabled" v-model="tuning" />
          <p v-else class="tuning-off-note">
            微调关闭。滑块不会显示，也不会写入提示词；生成将严格按档案本身的特征来。
          </p>
        </section>

        <section class="control-card paper-card">
          <div class="element-head">
            <span class="element-no mono">04</span>
            <div>
              <h2>发到哪个平台</h2>
              <p>平台决定篇幅和写法。</p>
            </div>
          </div>

          <div class="platform-grid">
            <button
              v-for="platform in platforms"
              :key="platform.key"
              type="button"
              class="platform-card"
              :class="{ active: selectedPlatform === platform.key }"
              @click="selectedPlatform = platform.key"
            >
              <el-icon><component :is="platformIcon(platform.key)" /></el-icon>
              <strong>{{ platform.label }}</strong>
              <span>{{ platform.tagline }}</span>
            </button>
          </div>
          <p v-if="currentPlatform" class="platform-description">
            {{ currentPlatform.description }}
            <b class="mono">{{ currentPlatform.minChars }}–{{ currentPlatform.maxChars }} 字</b>
          </p>

          <el-button
            type="primary"
            size="large"
            class="generate-btn"
            :loading="generating"
            @click="generate"
          >
            <el-icon v-if="!generating"><EditPen /></el-icon>
            {{ generating ? '正在按你的笔迹写…' : '生成这一篇' }}
          </el-button>
          <p class="generate-note">
            每次生成都会真实调用一次模型；未配置 LLM_API_KEY 时会直接报错，不会返回预置文案。
          </p>
        </section>
      </aside>

      <main ref="resultRef" class="result-area">
        <section v-if="generating" class="generating-card paper-card">
          <div class="writing-animation">
            <span class="seal writing-seal">写</span>
            <span class="writing-line line-one" />
            <span class="writing-line line-two" />
            <span class="writing-line line-three" />
          </div>
          <p class="eyebrow plain">Composing</p>
          <h2>正在按你的笔迹落笔</h2>
          <p class="generating-sub">
            {{ profileLabel(generationProfileId) }} · {{ platformLabel(selectedPlatform) }}
          </p>
          <div class="generation-stages">
            <span
              v-for="(stage, index) in generationStages"
              :key="stage"
              :class="{ active: index === generationStage, done: index < generationStage }"
            >
              <i />
              {{ stage }}
            </span>
          </div>
          <p class="generating-time">通常需要 10–40 秒，请稍候。</p>
        </section>

        <el-alert
          v-if="errorState"
          class="result-error"
          :title="errorState.title"
          type="error"
          show-icon
          :closable="false"
        >
          <p class="error-message">{{ errorState.message }}</p>
        </el-alert>

        <section v-if="!content && !generating" class="empty-result paper-card">
          <div class="empty-mark">
            <span class="seal empty-seal">笔</span>
            <span class="empty-ring ring-a" />
            <span class="empty-ring ring-b" />
          </div>
          <p class="eyebrow plain">Waiting for your three elements</p>
          <h2>先定三件事，再落笔。</h2>
          <p>
            写下这次想说什么，选一份笔迹（或不选），决定要不要微调。
            生成后，右侧会先出现正文，再进入“像不像你”的检测。
          </p>
          <div class="empty-steps">
            <span><i class="mono">01</i> 主题 / 素材</span>
            <span><i class="mono">02</i> 笔迹档案</span>
            <span><i class="mono">03</i> 微调开关</span>
          </div>
          <div v-if="demoData" class="empty-demo">
            <el-button size="small" type="primary" plain @click="applyDemo">
              一键载入演示设置
            </el-button>
            <span>示例设置会填入主题与档案；生成和改写需要配置 LLM_API_KEY。</span>
          </div>
        </section>

        <template v-if="content && !generating">
          <section class="result-card paper-card">
            <header class="result-head">
              <div>
                <span class="section-kicker">Draft</span>
                <div class="result-title-row">
                  <h2>{{ generation?.platformLabel || '生成结果' }}</h2>
                </div>
                <div class="result-meta">
                  <span>{{ generation?.profileName || '不使用档案' }}</span>
                  <i />
                  <span>{{ wordCount }} 字</span>
                  <i v-if="generationPlatform" />
                  <span v-if="generationPlatform">
                    目标 {{ generationPlatform.minChars }}–{{ generationPlatform.maxChars }} 字
                  </span>
                  <i />
                  <span>{{ formatDateTime(generation?.createdAt) }}</span>
                </div>
              </div>
              <div class="result-actions">
                <el-button size="small" @click="copyContent">
                  <el-icon><CopyDocument /></el-icon>
                  复制
                </el-button>
                <el-button
                  v-if="!score"
                  type="primary"
                  size="small"
                  :loading="scoring"
                  @click="runScore"
                >
                  <el-icon v-if="!scoring"><Aim /></el-icon>
                  检测像不像你
                </el-button>
                <el-button
                  v-else
                  size="small"
                  :loading="scoring"
                  @click="runScore"
                >
                  <el-icon v-if="!scoring"><Refresh /></el-icon>
                  重新检测
                </el-button>
              </div>
            </header>

            <div class="result-content content-prose" @click="handleContentClick">
              <p
                v-for="(paragraph, index) in paragraphs"
                :key="index"
                v-html="renderParagraph(paragraph, index)"
              />
            </div>

            <footer class="result-foot">
              <div class="word-status" :class="wordStatusClass">
                <i />
                {{ wordStatusText }}
              </div>
              <span class="content-hint">
                {{ score ? '带下划线的句子是检测出的问题，点击可跳到问题说明。' : '点击右上角“检测像不像你”，逐句对照你的档案。' }}
              </span>
            </footer>
          </section>

          <el-alert
            v-if="rewriteError"
            class="rewrite-error"
            :title="rewriteError.title"
            type="warning"
            show-icon
            :closable="true"
            @close="rewriteError = null"
          >
            <p>{{ rewriteError.message }}</p>
          </el-alert>

          <ScorePanel
            v-if="score"
            :score="score"
            :profile-name="generation?.profileName || ''"
            :rewrite-rounds="rewriteRounds"
            :max-rounds="2"
            :rewriting="rewriting"
            @rewrite="rewrite"
          />

          <ComparePane
            v-if="compare"
            :before="compare.before"
            :after="compare.after"
            :before-score="compare.beforeScore"
            :after-score="compare.afterScore"
          />
        </template>
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ChatDotRound, Star, VideoCamera } from '@element-plus/icons-vue';
import TuningSliders from '../components/TuningSliders.vue';
import ScorePanel from '../components/ScorePanel.vue';
import ComparePane from '../components/ComparePane.vue';
import { metaApi, profileApi, writingApi } from '../api';
import { countChars, formatDateTime } from '../utils/format';

const route = useRoute();

const platforms = ref([]);
const profiles = ref([]);
const demoData = ref(null);
const topic = ref('');
const selectedPlatform = ref('wechat');
const selectedProfileId = ref(null);
const tuningEnabled = ref(false);
const tuning = ref({ formality: 50, detail: 50, emotion: 50, assertiveness: 50 });

const generating = ref(false);
const generationStage = ref(0);
const scoring = ref(false);
const rewriting = ref(false);
const content = ref('');
const generation = ref(null);
const score = ref(null);
const compare = ref(null);
const rewriteRounds = ref(0);
const errorState = ref(null);
const rewriteError = ref(null);
const resultRef = ref(null);

let stageTimer = null;

const generationStages = [
  '搭一个具体的开头',
  '按档案调整语气和句长',
  '补上细节与平台格式',
];

const platformIconMap = {
  wechat: ChatDotRound,
  xiaohongshu: Star,
  douyin: VideoCamera,
};

const currentPlatform = computed(() =>
  platforms.value.find((platform) => platform.key === selectedPlatform.value)
);
const generationPlatform = computed(() =>
  platforms.value.find((platform) => platform.key === generation.value?.platform)
);
const wordCount = computed(() => countChars(content.value));
const paragraphs = computed(() =>
  String(content.value || '')
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
);
const generationProfileId = computed(() => generation.value?.profileId ?? selectedProfileId.value);

const wordStatusClass = computed(() => {
  if (!generationPlatform.value) return '';
  if (wordCount.value < generationPlatform.value.minChars) return 'short';
  if (wordCount.value > generationPlatform.value.maxChars) return 'long';
  return 'ok';
});
const wordStatusText = computed(() => {
  if (!generationPlatform.value) return `${wordCount.value} 字`;
  if (wordCount.value < generationPlatform.value.minChars) {
    return `还差 ${generationPlatform.value.minChars - wordCount.value} 字到平台下限`;
  }
  if (wordCount.value > generationPlatform.value.maxChars) {
    return `超出 ${wordCount.value - generationPlatform.value.maxChars} 字，建议删减`;
  }
  return '篇幅符合平台要求';
});

function platformIcon(key) {
  return platformIconMap[key] || ChatDotRound;
}

function platformLabel(key) {
  return platforms.value.find((platform) => platform.key === key)?.label || key;
}

function profileLabel(id) {
  if (!id) return '不使用档案';
  return profiles.value.find((profile) => profile.id === Number(id))?.name || '所选档案';
}

function startStageTicker() {
  generationStage.value = 0;
  window.clearInterval(stageTimer);
  stageTimer = window.setInterval(() => {
    if (generationStage.value < generationStages.length - 1) generationStage.value += 1;
  }, 4200);
}

function stopStageTicker() {
  window.clearInterval(stageTimer);
  stageTimer = null;
}

async function load() {
  try {
    const [meta, profileList, demo] = await Promise.all([
      metaApi.platforms(),
      profileApi.list(),
      metaApi.demo().catch(() => null),
    ]);
    platforms.value = meta.platforms || [];
    profiles.value = profileList.profiles || [];
    demoData.value = demo;

    const preferred = Number(route.query.profile);
    if (preferred && profiles.value.some((profile) => profile.id === preferred)) {
      selectedProfileId.value = preferred;
    }
  } catch (error) {
    ElMessage.error(error.message || '页面加载失败');
  }
}

function applyDemo() {
  if (!demoData.value) return;
  const writing = demoData.value.writing || {};
  topic.value = writing.topic || topic.value;
  selectedPlatform.value = writing.platform || selectedPlatform.value;
  tuning.value = { ...(writing.tuning || tuning.value) };
  tuningEnabled.value = false;

  const demoName = demoData.value.seedProfiles?.[1] || demoData.value.seedProfiles?.[0];
  const matched = profiles.value.find((profile) => profile.name === demoName);
  if (matched) {
    selectedProfileId.value = matched.id;
  } else if (profiles.value.length) {
    selectedProfileId.value = profiles.value[0].id;
  } else {
    selectedProfileId.value = null;
  }

  errorState.value = null;
  rewriteError.value = null;
  ElMessage.success('示例设置已载入');
}

async function generate() {
  if (generating.value) return;
  if (!topic.value.trim()) {
    ElMessage.warning('先写下这次想写什么');
    return;
  }
  if (!platforms.value.length) {
    ElMessage.error('平台信息还没有加载完成');
    return;
  }

  generating.value = true;
  errorState.value = null;
  rewriteError.value = null;
  score.value = null;
  compare.value = null;
  rewriteRounds.value = 0;
  content.value = '';
  startStageTicker();

  const payload = {
    topic: topic.value.trim(),
    platform: selectedPlatform.value,
    profileId: selectedProfileId.value ?? 0,
    tuningEnabled: tuningEnabled.value,
  };
  if (tuningEnabled.value) payload.tuning = { ...tuning.value };

  try {
    const data = await writingApi.generate(payload);
    content.value = data.content;
    generation.value = {
      id: data.id,
      platform: data.platform,
      platformLabel: platformLabel(data.platform),
      profileId: data.profileId ?? null,
      profileName: profileLabel(data.profileId),
      topic: payload.topic,
      createdAt: data.createdAt,
    };
    stopStageTicker();
    ElMessage.success('生成完成');
    await nextTick();
    resultRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    stopStageTicker();
    if (error.code === 'LLM_NOT_CONFIGURED') {
      errorState.value = {
        code: error.code,
        title: '尚未配置模型 API Key',
        message:
          error.message ||
          '请在 backend/.env 中配置 LLM_API_KEY 并重启后端，再重新生成。',
      };
    } else {
      errorState.value = {
        code: error.code,
        title: '这次没有生成成功',
        message: error.message || '请稍后再试，或检查模型配置。',
      };
    }
  } finally {
    generating.value = false;
    stopStageTicker();
  }
}

async function runScore() {
  if (!content.value || scoring.value) return;
  scoring.value = true;
  rewriteError.value = null;
  try {
    const data = await writingApi.score({
      content: content.value,
      platform: generation.value?.platform || selectedPlatform.value,
      profileId: generation.value?.profileId ?? 0,
    });
    score.value = data.score;
    if (!data.score.issues?.length) {
      ElMessage.success('没有发现明显问题');
    }
  } catch (error) {
    ElMessage.error(error.message || '检测失败，请稍后再试');
  } finally {
    scoring.value = false;
  }
}

async function rewrite() {
  if (!score.value || rewriting.value) return;
  if (rewriteRounds.value >= 2) {
    ElMessage.warning('已经达到 2 轮重写上限');
    return;
  }

  rewriting.value = true;
  rewriteError.value = null;
  const beforeContent = content.value;

  try {
    const data = await writingApi.rewrite({
      content: beforeContent,
      problems: score.value.issues || [],
      profileId: generation.value?.profileId ?? 0,
      platform: generation.value?.platform || selectedPlatform.value,
      topic: generation.value?.topic || topic.value,
    });

    // 每次拿到模型响应都计 1 轮（包括未采用），用于限制 API 消耗。
    rewriteRounds.value += 1;

    if (data.accepted === false) {
      // 后端已判定候选稿降分，正文与评分都保持原稿。
      content.value = data.content;
      score.value = data.score;
      rewriteError.value = {
        code: 'REWRITE_NOT_IMPROVED',
        title: '本轮改写未提升',
        message: `本轮改写未提升：${data.beforeScore} → ${data.afterScore}，已保留原稿。`,
      };
      return;
    }

    content.value = data.content;
    score.value = data.score;

    if (!compare.value) {
      compare.value = {
        before: beforeContent,
        after: data.content,
        beforeScore: data.beforeScore,
        afterScore: data.afterScore,
      };
    } else {
      compare.value = {
        ...compare.value,
        after: data.content,
        afterScore: data.afterScore,
      };
    }

    ElMessage.success(
      `第 ${rewriteRounds.value} 轮改写完成：${data.beforeScore} → ${data.afterScore}`
    );
  } catch (error) {
    if (error.code === 'LLM_NOT_CONFIGURED') {
      rewriteError.value = {
        code: error.code,
        title: '尚未配置模型 API Key',
        message:
          error.message ||
          '请在 backend/.env 中配置 LLM_API_KEY 并重启后端，再重新改写。',
      };
    } else {
      rewriteError.value = {
        code: error.code,
        title: '这次没有改写成功',
        message: error.message || '请稍后重试。',
      };
    }
  } finally {
    rewriting.value = false;
  }
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderParagraph(paragraph, index) {
  let html = escapeHtml(paragraph);
  const issues =
    score.value?.issues?.filter((issue) => issue.paragraph === index + 1 && issue.sentence) || [];

  for (const issue of issues) {
    const sentence = escapeHtml(issue.sentence);
    if (!sentence || !html.includes(sentence)) continue;
    html = html.replace(
      sentence,
      `<mark class="ink-mark ${issue.severity}" data-issue="${issue.id}" title="${escapeHtml(issue.reason)}">${sentence}</mark>`
    );
  }
  return html;
}

function handleContentClick(event) {
  const mark = event.target.closest('mark[data-issue]');
  if (!mark) return;
  const card = document.querySelector(`.issue-card[data-issue="${mark.dataset.issue}"]`);
  card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function copyContent() {
  if (!content.value) return;
  try {
    await navigator.clipboard.writeText(content.value);
    ElMessage.success('正文已复制');
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = content.value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    ElMessage.success('正文已复制');
  }
}

onMounted(load);
onBeforeUnmount(stopStageTicker);
</script>

<style scoped>
.write-page {
  max-width: 1320px;
  padding-top: 40px;
}

.write-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 30px;
  margin-bottom: 30px;
}

.write-header .page-title {
  font-size: clamp(30px, 3.5vw, 43px);
}

.header-side {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
}

.write-layout {
  display: grid;
  grid-template-columns: 390px minmax(0, 1fr);
  gap: 26px;
  align-items: start;
}

.control-panel {
  position: sticky;
  top: 22px;
  display: flex;
  flex-direction: column;
  gap: 13px;
  max-height: calc(100vh - 44px);
  overflow-y: auto;
  padding-right: 4px;
}

.control-panel::-webkit-scrollbar {
  width: 5px;
}

.control-card {
  padding: 20px 20px 18px;
}

.element-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 14px;
}

.element-no {
  flex: none;
  padding-top: 3px;
  color: var(--vermilion);
  font-size: 9.5px;
  font-weight: 600;
}

.element-head h2 {
  font-size: 16px;
  letter-spacing: -0.015em;
}

.element-head p {
  margin-top: 3px;
  color: var(--muted-soft);
  font-size: 9.5px;
  line-height: 1.5;
}

.element-head > .el-switch {
  margin-left: auto;
  margin-top: 4px;
}

.char-counter {
  margin-left: auto;
  padding-top: 3px;
  color: var(--muted-soft);
  font-size: 8.5px;
  white-space: nowrap;
}

.topic-hint {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-top: 9px;
}

.topic-hint > span {
  color: var(--muted-soft);
  font-size: 9px;
  line-height: 1.6;
}

.demo-topic-btn {
  flex: none;
  padding: 0;
  font-size: 9px;
}

.profile-options {
  display: flex;
  flex-direction: column;
  gap: 7px;
  max-height: 268px;
  overflow-y: auto;
  padding-right: 3px;
}

.profile-options::-webkit-scrollbar {
  width: 4px;
}

.profile-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 11px 12px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: rgba(255, 253, 248, 0.4);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.profile-option:hover {
  border-color: var(--line-strong);
}

.profile-option.active {
  border-color: rgba(185, 65, 43, 0.42);
  background: rgba(185, 65, 43, 0.06);
}

.radio-dot {
  display: block;
  flex: none;
  width: 12px;
  height: 12px;
  margin-top: 3px;
  border: 1px solid var(--line-strong);
  border-radius: 50%;
  background: var(--paper-bright);
  box-shadow: inset 0 0 0 3px var(--paper-bright);
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.profile-option.active .radio-dot {
  border-color: var(--vermilion);
  background: var(--vermilion);
}

.option-copy {
  min-width: 0;
  flex: 1;
}

.option-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.option-title strong {
  font-family: var(--font-serif);
  font-size: 12.5px;
  font-weight: 600;
}

.option-tag {
  padding: 1px 5px;
  border-radius: 2px;
  background: rgba(28, 27, 24, 0.06);
  color: var(--muted-soft);
  font-size: 8px;
}

.option-meta {
  flex: none;
  color: var(--muted-soft);
  font-size: 8.5px;
}

.option-copy > p {
  display: -webkit-box;
  margin-top: 3px;
  overflow: hidden;
  color: var(--muted);
  font-size: 9.5px;
  line-height: 1.55;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.option-phrases {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

.option-phrases span {
  padding: 1px 5px;
  border: 1px solid var(--line);
  border-radius: 2px;
  color: var(--muted-soft);
  font-size: 8px;
}

.no-profile-note {
  margin-top: 10px;
  color: var(--muted-soft);
  font-size: 9px;
  line-height: 1.6;
}

.no-profile-note a {
  color: var(--vermilion);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.tuning-off-note {
  padding: 12px 13px;
  border: 1px dashed var(--line);
  border-radius: 5px;
  color: var(--muted-soft);
  font-size: 9.5px;
  line-height: 1.65;
}

.platform-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 7px;
}

.platform-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 11px 5px 9px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: rgba(255, 253, 248, 0.4);
  color: inherit;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.platform-card:hover {
  border-color: var(--line-strong);
}

.platform-card.active {
  border-color: rgba(185, 65, 43, 0.42);
  background: rgba(185, 65, 43, 0.06);
}

.platform-card .el-icon {
  color: var(--muted);
  font-size: 16px;
}

.platform-card.active .el-icon {
  color: var(--vermilion);
}

.platform-card strong {
  font-family: var(--font-serif);
  font-size: 10.5px;
  font-weight: 600;
}

.platform-card span {
  color: var(--muted-soft);
  font-size: 7.5px;
  line-height: 1.35;
}

.platform-description {
  margin-top: 10px;
  color: var(--muted);
  font-size: 9.5px;
  line-height: 1.6;
}

.platform-description b {
  margin-left: 4px;
  color: var(--ink-soft);
  font-weight: 500;
}

.generate-btn {
  width: 100%;
  height: 45px;
  margin-top: 15px;
  letter-spacing: 0.02em;
}

.generate-note {
  margin-top: 8px;
  color: var(--muted-soft);
  font-size: 8.5px;
  line-height: 1.55;
  text-align: center;
}

.result-area {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
  min-height: 620px;
  scroll-margin-top: 20px;
}

.empty-result,
.generating-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 620px;
  padding: 50px 44px;
  text-align: center;
  background:
    radial-gradient(circle at 50% 18%, rgba(185, 65, 43, 0.055), transparent 42%),
    rgba(255, 253, 248, 0.62);
}

.empty-mark {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 122px;
  height: 122px;
  margin-bottom: 30px;
}

.empty-seal {
  width: 52px;
  height: 52px;
  font-size: 27px;
}

.empty-ring {
  position: absolute;
  border: 1px solid var(--line);
  border-radius: 50%;
}

.ring-a {
  inset: 9px;
  border-style: dashed;
}

.ring-b {
  inset: 0;
  opacity: 0.5;
}

.empty-result h2,
.generating-card h2 {
  margin-top: 12px;
  font-size: 29px;
  letter-spacing: -0.03em;
}

.empty-result > p:not(.eyebrow),
.generating-sub {
  max-width: 440px;
  margin-top: 12px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.9;
}

.empty-steps {
  display: flex;
  gap: 22px;
  margin-top: 26px;
  padding-top: 20px;
  border-top: 1px solid var(--line);
}

.empty-steps span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 9.5px;
}

.empty-steps i {
  color: var(--vermilion);
  font-size: 8.5px;
  font-style: normal;
}

.empty-demo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 28px;
  padding: 10px 14px;
  border: 1px dashed var(--line-strong);
  border-radius: 5px;
  background: rgba(255, 253, 248, 0.6);
}

.empty-demo span {
  color: var(--muted-soft);
  font-size: 9px;
  line-height: 1.5;
  text-align: left;
}

.writing-animation {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 120px;
  height: 120px;
  margin-bottom: 26px;
}

.writing-seal {
  width: 52px;
  height: 52px;
  font-size: 27px;
  animation: breathe 2.2s ease-in-out infinite;
}

@keyframes breathe {
  0%,
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(185, 65, 43, 0.18);
  }
  50% {
    transform: scale(1.04);
    box-shadow: 0 0 0 12px rgba(185, 65, 43, 0);
  }
}

.writing-line {
  position: absolute;
  left: 50%;
  height: 1px;
  background: var(--line-strong);
  transform-origin: left center;
  animation: sweep 2.4s ease-in-out infinite;
}

.line-one {
  top: 16px;
  width: 42px;
  transform: rotate(-38deg);
  animation-delay: 0s;
}

.line-two {
  bottom: 16px;
  width: 50px;
  transform: rotate(30deg);
  animation-delay: 0.35s;
}

.line-three {
  top: 50%;
  width: 60px;
  transform: rotate(8deg);
  animation-delay: 0.7s;
}

@keyframes sweep {
  0%,
  100% {
    opacity: 0.25;
  }
  50% {
    opacity: 0.85;
  }
}

.generation-stages {
  display: flex;
  gap: 18px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--line);
}

.generation-stages span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--muted-soft);
  font-size: 9.5px;
  transition: color 0.3s ease;
}

.generation-stages i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--line-strong);
  transition: background-color 0.3s ease;
}

.generation-stages span.active {
  color: var(--vermilion);
}

.generation-stages span.active i {
  background: var(--vermilion);
  animation: pulse 1.2s ease-in-out infinite;
}

.generation-stages span.done {
  color: var(--jade);
}

.generation-stages span.done i {
  background: var(--jade);
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

.generating-time {
  margin-top: 22px;
  color: var(--muted-soft);
  font-size: 9px;
}

.result-error,
.rewrite-error {
  border-radius: 6px;
}

.error-message {
  margin-top: 4px;
  font-size: 11.5px;
  line-height: 1.7;
}

.result-card {
  overflow: hidden;
}

.result-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 26px 30px 20px;
  border-bottom: 1px solid var(--line);
}

.result-title-row {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 5px;
}

.result-title-row h2 {
  font-size: 24px;
  letter-spacing: -0.025em;
}

.result-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
  color: var(--muted-soft);
  font-size: 9.5px;
}

.result-meta i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--line-strong);
}

.result-actions {
  display: flex;
  gap: 7px;
  flex: none;
}

.result-content {
  max-height: 760px;
  overflow-y: auto;
  padding: 32px 36px 34px;
  font-size: 16.5px;
  line-height: 2.05;
}

.result-content :deep(p + p) {
  margin-top: 1.08em;
}

.result-content :deep(.ink-mark) {
  padding: 1px 0;
  border-radius: 2px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-decoration-line: underline;
  text-decoration-style: wavy;
  text-underline-offset: 5px;
  transition: background-color 0.2s ease;
}

.result-content :deep(.ink-mark.high) {
  background: rgba(185, 65, 43, 0.09);
  text-decoration-color: var(--vermilion);
}

.result-content :deep(.ink-mark.medium) {
  background: rgba(169, 132, 69, 0.1);
  text-decoration-color: var(--gold);
}

.result-content :deep(.ink-mark.low) {
  text-decoration-color: var(--muted-soft);
}

.result-content :deep(.ink-mark:hover) {
  background: rgba(185, 65, 43, 0.15);
}

.result-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 14px 30px;
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

.content-hint {
  color: var(--muted-soft);
  font-size: 9px;
  text-align: right;
}

@media (max-width: 1120px) {
  .write-layout {
    grid-template-columns: 340px minmax(0, 1fr);
  }
}

@media (max-width: 960px) {
  .write-layout {
    grid-template-columns: 1fr;
  }

  .control-panel {
    position: static;
    max-height: none;
    overflow: visible;
    padding-right: 0;
  }

  .result-area {
    min-height: 460px;
  }

  .empty-result,
  .generating-card {
    min-height: 460px;
  }
}

@media (max-width: 680px) {
  .write-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .result-head {
    flex-direction: column;
    gap: 14px;
    padding: 20px 18px 16px;
  }

  .result-actions {
    width: 100%;
  }

  .result-actions .el-button {
    flex: 1;
    margin-left: 0;
  }

  .result-content {
    padding: 24px 20px 26px;
    font-size: 16px;
  }

  .result-foot {
    flex-direction: column;
    align-items: flex-start;
    gap: 7px;
    padding: 12px 18px;
  }

  .content-hint {
    text-align: left;
  }

  .generation-stages {
    flex-direction: column;
    gap: 8px;
  }

  .empty-steps {
    flex-direction: column;
    gap: 8px;
  }

  .empty-demo {
    flex-direction: column;
  }

  .empty-result,
  .generating-card {
    padding: 36px 22px;
  }
}
</style>
