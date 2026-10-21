<template>
  <div class="page-shell write-page">
    <header class="write-header">
      <div>
        <p class="eyebrow">Writing desk · 写作台</p>
        <h1 class="page-title">先写出来，<br />再改成你的。</h1>
        <p class="page-subtitle">
          三要素定下第一稿，正文会直接进入写作台，可以手动增删改。
          重新生成是一次全新的写作，新版本放在侧边，不会覆盖当前文章；旁边的助手可以随时问。
        </p>
      </div>

      <div class="header-side">
        <el-button v-if="demoData" size="small" @click="applyDemo">
          <el-icon><MagicStick /></el-icon>
          载入演示设置
        </el-button>
        <el-button size="small" @click="startNew">
          <el-icon><DocumentAdd /></el-icon>
          新建文章
        </el-button>
        <el-button size="small" @click="router.push({ name: 'articles' })">
          <el-icon><Document /></el-icon>
          我的文章
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
            <span>
              这段只作为提示词，不会写进文章；标题和正文由模型另外生成。
              带一点具体场景、对象或情绪，会比一句宽泛的题目更好写。
            </span>
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
            @click="leftGenerate"
          >
            <el-icon v-if="!generating"><EditPen /></el-icon>
            {{
              generating
                ? (content ? '正在生成候选稿…' : '正在按你的笔迹写…')
                : (content ? '生成侧边候选稿' : '生成这一篇')
            }}
          </el-button>
          <p class="generate-note">
            <template v-if="content">
              写作台已有内容；本次生成会放在侧边，不会覆盖当前文章。
            </template>
            <template v-else>
              每次生成都会真实调用一次模型；未配置 LLM_API_KEY 时会直接报错，不会返回预置文案。
            </template>
          </p>
        </section>
      </aside>

      <main ref="resultRef" class="desk-area">
        <div class="desk-main">
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

          <section v-if="generating && !content" class="generating-card paper-card">
            <div class="writing-animation">
              <span class="seal writing-seal">写</span>
              <span class="writing-line line-one" />
              <span class="writing-line line-two" />
              <span class="writing-line line-three" />
            </div>
            <p class="eyebrow plain">Composing</p>
            <h2>正在按你的笔迹落笔</h2>
            <p class="generating-sub">
              {{ pendingMeta.profileName }} · {{ pendingMeta.platformLabel }}
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

          <template v-else>
            <ArticleEditor
              :model-value="content"
              :title="articleTitle"
              :platform-label="editorPlatformLabel"
              :profile-name="editorProfileName"
              :created-at="generation?.createdAt || null"
              :word-status-text="wordStatusText"
              :word-status-class="wordStatusClass"
              :saving="saving"
              :saved="Boolean(savedArticleId)"
              :saved-at="savedAt"
              :dirty="isDirty"
              :scoring="scoring"
              :has-score="Boolean(score)"
              :generating="generating"
              :can-regenerate="canRegenerate"
              :can-save="canSave"
              @update:model-value="handleContentUpdate"
              @update:title="articleTitle = $event"
              @save="saveArticle"
              @regenerate="regenerate"
              @score="runScore"
              @copy="copyContent"
              @new="startNew"
            />

            <ScorePanel
              v-if="score"
              :score="score"
              :profile-name="editorProfileName"
            />
          </template>
        </div>

        <aside class="desk-side">
          <CandidatePanel
            v-if="candidate"
            :candidate="candidate"
            :current-score="score?.score ?? null"
            @accept="acceptCandidate"
            @dismiss="dismissCandidate"
          />

          <AssistantPanel
            v-model="assistantDraft"
            :messages="assistantMessages"
            :loading="assistantLoading"
            @send="sendAssistant"
            @clear="clearAssistant"
          />
        </aside>
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ChatDotRound, Star, VideoCamera } from '@element-plus/icons-vue';
import TuningSliders from '../components/TuningSliders.vue';
import ScorePanel from '../components/ScorePanel.vue';
import ArticleEditor from '../components/ArticleEditor.vue';
import CandidatePanel from '../components/CandidatePanel.vue';
import AssistantPanel from '../components/AssistantPanel.vue';
import { articleApi, assistantApi, metaApi, profileApi, writingApi } from '../api';
import { countChars } from '../utils/format';

const route = useRoute();
const router = useRouter();

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
const content = ref('');
const articleTitle = ref('');
const generation = ref(null);
const score = ref(null);
const candidate = ref(null);
const errorState = ref(null);
const resultRef = ref(null);
const pendingMeta = ref({ profileName: '不使用档案', platformLabel: '' });

const savedArticleId = ref(null);
const savedAt = ref(null);
const lastSavedContent = ref('');
const lastSavedTitle = ref('');
const saving = ref(false);

const assistantMessages = ref([]);
const assistantDraft = ref('');
const assistantLoading = ref(false);

let stageTimer = null;
let candidateScoreToken = 0;

const generationStages = [
  '读一遍主题和素材',
  '对照档案原文找语感',
  '重新写出一整篇',
];

const platformIconMap = {
  wechat: ChatDotRound,
  xiaohongshu: Star,
  douyin: VideoCamera,
};

const currentPlatform = computed(() =>
  platforms.value.find((platform) => platform.key === selectedPlatform.value)
);
const activePlatform = computed(() =>
  platforms.value.find(
    (platform) => platform.key === (generation.value?.platform || selectedPlatform.value)
  )
);
const wordCount = computed(() => countChars(content.value));
const editorPlatformLabel = computed(
  () => generation.value?.platformLabel || platformLabel(selectedPlatform.value)
);
const editorProfileName = computed(
  () => generation.value?.profileName || profileLabel(selectedProfileId.value)
);
const isDirty = computed(() => {
  if (!content.value && !articleTitle.value.trim()) return false;
  return (
    content.value !== lastSavedContent.value ||
    articleTitle.value !== lastSavedTitle.value
  );
});
const canSave = computed(
  () =>
    Boolean(content.value.trim()) &&
    !saving.value &&
    (!savedArticleId.value || isDirty.value)
);
const canRegenerate = computed(
  () => Boolean(generation.value || content.value.trim()) && !generating.value
);

const wordStatusClass = computed(() => {
  if (!activePlatform.value) return '';
  if (wordCount.value < activePlatform.value.minChars) return 'short';
  if (wordCount.value > activePlatform.value.maxChars) return 'long';
  return 'ok';
});
const wordStatusText = computed(() => {
  if (!activePlatform.value) return `${wordCount.value} 字`;
  if (wordCount.value < activePlatform.value.minChars) {
    return `还差 ${activePlatform.value.minChars - wordCount.value} 字到平台下限`;
  }
  if (wordCount.value > activePlatform.value.maxChars) {
    return `超出 ${wordCount.value - activePlatform.value.maxChars} 字，建议删减`;
  }
  return '篇幅符合平台要求';
});

function platformIcon(key) {
  return platformIconMap[key] || ChatDotRound;
}

function platformLabel(key) {
  return platforms.value.find((platform) => platform.key === key)?.label || key || '未选平台';
}

function profileLabel(id) {
  if (!id) return '不使用档案';
  return profiles.value.find((profile) => profile.id === Number(id))?.name || '所选档案';
}

function deriveTitle(text) {
  const firstLine = String(text || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  return (firstLine || '').slice(0, 40);
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

    const articleId = Number(route.query.article);
    if (Number.isInteger(articleId) && articleId > 0) {
      await loadArticle(articleId);
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
  ElMessage.success('示例设置已载入');
}

function buildGenerationPayload({ regenerate = false } = {}) {
  // “重新生成”沿用第一遍的主题、档案和平台，不读取写作台里手动改过的正文。
  if (regenerate && generation.value) {
    const snapshot = generation.value;
    return {
      topic: snapshot.topic,
      platform: snapshot.platform,
      profileId: snapshot.profileId ?? 0,
      tuningEnabled: Boolean(snapshot.tuningEnabled),
      ...(snapshot.tuningEnabled && snapshot.tuning
        ? { tuning: { ...snapshot.tuning } }
        : {}),
    };
  }

  const payload = {
    topic: topic.value.trim(),
    platform: selectedPlatform.value,
    profileId: selectedProfileId.value ?? 0,
    tuningEnabled: tuningEnabled.value,
  };
  if (tuningEnabled.value) payload.tuning = { ...tuning.value };
  return payload;
}

async function generate(options = {}) {
  if (generating.value) return;

  const regenerate = options.mode === 'regenerate';
  const payload = buildGenerationPayload({ regenerate });
  if (!payload.topic) {
    ElMessage.warning('先写下这次想写什么');
    return;
  }
  if (!platforms.value.length) {
    ElMessage.error('平台信息还没有加载完成');
    return;
  }

  const hasCurrent = Boolean(content.value.trim());
  const willReplace = !hasCurrent;

  pendingMeta.value = {
    profileName: profileLabel(payload.profileId),
    platformLabel: platformLabel(payload.platform),
  };
  generating.value = true;
  errorState.value = null;
  if (!willReplace) {
    candidate.value = {
      loading: true,
      content: '',
      scoring: false,
      score: null,
      generation: null,
      createdAt: null,
    };
  }
  startStageTicker();

  try {
    const data = await writingApi.generate(payload);
    const snapshot = {
      id: data.id,
      title: data.title || '',
      platform: data.platform,
      platformLabel: platformLabel(data.platform),
      profileId: data.profileId ?? null,
      profileName: profileLabel(data.profileId),
      topic: payload.topic,
      tuningEnabled: Boolean(payload.tuningEnabled),
      tuning: payload.tuning ? { ...payload.tuning } : null,
      createdAt: data.createdAt,
    };

    if (willReplace) {
      content.value = data.content;
      // 标题和正文由模型一起生成；只有模型漏掉标题时才用主题兜底。
      articleTitle.value = data.title || deriveTitle(payload.topic);
      // 新的第一稿不继承旧文章的保存 id，避免误覆盖“我的文章”里的旧稿。
      savedArticleId.value = null;
      savedAt.value = null;
      lastSavedContent.value = '';
      lastSavedTitle.value = '';
      generation.value = snapshot;
      score.value = null;
      candidate.value = null;
      ElMessage.success('第一稿已放进写作台，可以直接修改');
    } else {
      candidate.value = {
        loading: false,
        title: data.title || deriveTitle(payload.topic),
        content: data.content,
        scoring: true,
        score: null,
        generation: snapshot,
        createdAt: data.createdAt,
      };
      ElMessage.success('候选稿已生成，当前文章没有改动');
      scoreCandidate(data.content, snapshot);
    }

    await nextTick();
    resultRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    candidate.value = null;
    if (error.code === 'NO_API_KEY') {
      errorState.value = {
        code: error.code,
        title: '无 API Key',
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

function leftGenerate() {
  generate({ mode: 'auto' });
}

function regenerate() {
  generate({ mode: 'regenerate' });
}

async function scoreCandidate(text, snapshot) {
  const token = ++candidateScoreToken;
  try {
    const data = await writingApi.score({
      content: text,
      platform: snapshot.platform,
      profileId: snapshot.profileId ?? 0,
    });
    if (token !== candidateScoreToken) return;
    if (!candidate.value || candidate.value.content !== text) return;
    candidate.value = {
      ...candidate.value,
      score: data.score,
      scoring: false,
    };
  } catch {
    if (token !== candidateScoreToken) return;
    if (candidate.value && candidate.value.content === text) {
      candidate.value = { ...candidate.value, scoring: false };
    }
  }
}

function acceptCandidate() {
  const current = candidate.value;
  if (!current?.content) return;
  candidateScoreToken += 1;
  content.value = current.content;
  // 替换正文时一并采用候选稿的标题；用户之后仍可手动改。
  articleTitle.value = current.title || articleTitle.value || deriveTitle(current.generation?.topic || '');
  score.value = current.score || null;
  generation.value = current.generation || generation.value;
  candidate.value = null;
  errorState.value = null;
  ElMessage.success('已替换为候选稿，记得保存');
}

function dismissCandidate() {
  candidateScoreToken += 1;
  candidate.value = null;
  ElMessage.info('已保留当前文章');
}

function handleContentUpdate(value) {
  content.value = value;
  // 正文一改，旧检测结果就不再对应当前内容。
  if (score.value) score.value = null;
}

async function runScore() {
  if (!content.value.trim() || scoring.value) return;
  const scoredContent = content.value;
  scoring.value = true;
  try {
    const data = await writingApi.score({
      content: scoredContent,
      platform: generation.value?.platform || selectedPlatform.value,
      // 有生成快照时按当时的档案检测，避免侧边控制项改选后分数与显示不一致。
      profileId: generation.value
        ? generation.value.profileId ?? 0
        : selectedProfileId.value ?? 0,
    });
    // 检测期间正文如果又被改过，丢掉这次旧结果。
    if (content.value !== scoredContent) return;
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

async function saveArticle() {
  if (!content.value.trim() || saving.value) return;
  saving.value = true;
  try {
    const payload = {
      title: articleTitle.value.trim(),
      content: content.value,
      topic: generation.value?.topic || topic.value.trim(),
      platform: generation.value?.platform || selectedPlatform.value,
      // 快照里的 null 表示“不使用档案”，不要被后来改选的档案覆盖。
      profileId: generation.value
        ? generation.value.profileId ?? null
        : selectedProfileId.value ?? null,
    };
    const data = savedArticleId.value
      ? await articleApi.update(savedArticleId.value, payload)
      : await articleApi.create(payload);
    const article = data.article;
    savedArticleId.value = article.id;
    articleTitle.value = article.title;
    savedAt.value = article.updatedAt;
    lastSavedContent.value = article.content;
    lastSavedTitle.value = article.title;
    ElMessage.success('文章已保存到「我的文章」');
  } catch (error) {
    ElMessage.error(error.message || '保存失败，请稍后再试');
  } finally {
    saving.value = false;
  }
}

async function loadArticle(id) {
  try {
    const data = await articleApi.detail(id);
    const article = data.article;
    content.value = article.content;
    articleTitle.value = article.title;
    savedArticleId.value = article.id;
    savedAt.value = article.updatedAt;
    lastSavedContent.value = article.content;
    lastSavedTitle.value = article.title;
    score.value = null;
    candidate.value = null;
    errorState.value = null;
    selectedPlatform.value = article.platform || selectedPlatform.value;
    selectedProfileId.value = article.profileId ?? null;
    topic.value = article.topic || article.title || '';
    generation.value = {
      id: null,
      platform: article.platform,
      platformLabel: article.platformLabel,
      profileId: article.profileId,
      profileName: article.profileName || '不使用档案',
      topic: article.topic || article.title || '',
      tuningEnabled: false,
      tuning: null,
      createdAt: article.createdAt,
    };
    ElMessage.success(`已打开「${article.title}」`);
  } catch (error) {
    ElMessage.error(error.message || '文章加载失败');
    if (route.query.article) await router.replace({ name: 'write' });
  }
}

async function startNew() {
  if (isDirty.value) {
    try {
      await ElMessageBox.confirm(
        '写作台还有未保存的修改，新建会清空当前内容。',
        '新建文章',
        {
          confirmButtonText: '新建',
          cancelButtonText: '取消',
          type: 'warning',
        }
      );
    } catch {
      return;
    }
  }

  candidateScoreToken += 1;
  content.value = '';
  articleTitle.value = '';
  savedArticleId.value = null;
  savedAt.value = null;
  lastSavedContent.value = '';
  lastSavedTitle.value = '';
  score.value = null;
  candidate.value = null;
  generation.value = null;
  errorState.value = null;
  if (route.query.article) await router.replace({ name: 'write' });
  ElMessage.success('写作台已清空，可以写新的了');
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

async function sendAssistant(question) {
  const text = String(question || '').trim();
  if (!text || assistantLoading.value) return;
  const userMessage = { role: 'user', content: text };
  const history = [...assistantMessages.value, userMessage].slice(-20);
  assistantMessages.value = history;
  assistantDraft.value = '';
  assistantLoading.value = true;
  try {
    const data = await assistantApi.chat(history);
    assistantMessages.value = [
      ...assistantMessages.value,
      { role: 'assistant', content: data.reply },
    ];
  } catch (error) {
    assistantMessages.value = assistantMessages.value.slice(0, -1);
    assistantDraft.value = text;
    ElMessage.error(error.message || '助手暂时没有回应');
  } finally {
    assistantLoading.value = false;
  }
}

async function clearAssistant() {
  if (!assistantMessages.value.length || assistantLoading.value) return;
  try {
    await ElMessageBox.confirm('清空当前对话？', '清空对话', {
      confirmButtonText: '清空',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }
  assistantMessages.value = [];
  assistantDraft.value = '';
}

watch(
  () => route.query.article,
  (value, oldValue) => {
    if (!value || value === oldValue) return;
    const id = Number(value);
    if (Number.isInteger(id) && id > 0) loadArticle(id);
  }
);

onMounted(load);
onBeforeUnmount(stopStageTicker);
</script>

<style scoped>
.write-page {
  max-width: 1560px;
  padding-top: 40px;
}

.write-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 30px;
  margin-bottom: 28px;
}

.write-header .page-title {
  font-size: clamp(30px, 3.5vw, 43px);
}

.header-side {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  flex: none;
}

.write-layout {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: 22px;
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

.desk-area {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 350px;
  gap: 18px;
  align-items: start;
  min-width: 0;
  min-height: 620px;
  scroll-margin-top: 20px;
}

.desk-main {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
}

.desk-side {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
}

.result-error {
  border-radius: 6px;
}

.error-message {
  margin-top: 4px;
  font-size: 11.5px;
  line-height: 1.7;
}

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

.generating-card h2 {
  margin-top: 12px;
  font-size: 29px;
  letter-spacing: -0.03em;
}

.generating-sub {
  max-width: 440px;
  margin-top: 12px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.9;
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

@media (max-width: 1700px) {
  .write-layout {
    grid-template-columns: 1fr;
  }

  .control-panel {
    position: static;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 13px;
    max-height: none;
    overflow: visible;
    padding-right: 0;
  }
}

@media (max-width: 1250px) {
  .desk-area {
    grid-template-columns: 1fr;
  }

  .desk-side {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    align-items: start;
  }
}

@media (max-width: 900px) {
  .control-panel {
    grid-template-columns: 1fr;
  }

  .desk-side {
    grid-template-columns: 1fr;
  }

  .generating-card {
    min-height: 460px;
  }
}

@media (max-width: 720px) {
  .write-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .header-side {
    justify-content: flex-start;
  }

  .generation-stages {
    flex-direction: column;
    gap: 8px;
  }

  .generating-card {
    padding: 36px 22px;
  }
}
</style>
