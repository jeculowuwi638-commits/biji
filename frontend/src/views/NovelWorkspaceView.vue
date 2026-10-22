<template>
  <div class="page-shell workspace-page">
    <WritingModeSwitch mode="novel" />

    <div class="workspace-topline">
      <button type="button" class="back-link" @click="goBack">
        <el-icon><ArrowLeft /></el-icon>
        全部小说
      </button>
      <span class="topline-note">原始章节只读 · 续写只追加</span>
    </div>

    <section v-if="loading" class="workspace-loading paper-card">
      <el-skeleton :rows="10" animated />
    </section>

    <section v-else-if="notFound" class="load-error paper-card">
      <span class="seal">寻</span>
      <h1>没有找到这部作品</h1>
      <p>它可能已经被删除，或者不属于当前账号。</p>
      <el-button type="primary" @click="goBack">回到小说列表</el-button>
    </section>

    <section v-else-if="loadError" class="load-error paper-card">
      <span class="seal">!</span>
      <h1>工作台没有打开</h1>
      <p>{{ loadError }}</p>
      <el-button type="primary" @click="load">重新加载</el-button>
    </section>

    <template v-else-if="novel">
      <header class="novel-head">
        <div class="novel-title-wrap">
          <div class="title-line">
            <span class="seal title-seal">说</span>
            <div>
              <p class="eyebrow plain">Novel workspace · 小说工作台</p>
              <h1 class="novel-title">{{ novel.title }}</h1>
            </div>
          </div>
          <p class="novel-desc">
            {{ novel.description || '还没有作品简介。可在作品设置中补充题材、核心人物和不能写崩的设定。' }}
          </p>
          <div class="novel-tags">
            <span>{{ novel.narratorLabel }}</span>
            <span>{{ chapters.length }} 章正文</span>
            <span v-if="novel.styleProfile">笔迹 · {{ novel.styleProfile.name }}</span>
            <span v-else class="tag-pending">笔迹待生成</span>
            <span v-if="novel.strictSettings" class="tag-strict">严格守设定</span>
          </div>
        </div>

        <div class="head-actions">
          <el-button @click="bibleVisible = true">
            <el-icon><Collection /></el-icon>
            故事记忆卡
            <span v-if="bibleReady" class="action-badge mono">{{ openCount }}</span>
          </el-button>
          <el-button @click="assistantVisible = true">
            <el-icon><ChatDotRound /></el-icon>
            问小说助手
          </el-button>
          <el-button @click="settingsVisible = true">
            <el-icon><Setting /></el-icon>
            作品设置
          </el-button>
        </div>
      </header>

      <section class="story-band paper-card" :class="{ attention: !bibleReady || bibleStale }">
        <div class="story-state">
          <span class="story-mark">记</span>
          <div class="story-copy">
            <p class="story-kicker">Story memory</p>
            <p v-if="analyzing" class="story-line">
              <el-icon class="is-loading"><Loading /></el-icon>
              正在提取故事记忆卡与文风档案，通常需要几十秒。
            </p>
            <p v-else-if="!bibleReady" class="story-line">
              还没有故事记忆卡。导入章节后先分析，续写才知道人物知道什么、哪些伏笔还没回收。
            </p>
            <p v-else-if="bibleStale" class="story-line">
              记忆卡只覆盖前 {{ bible.sourceChapters }} 章，最近 {{ bibleStaleCount }} 章还没有纳入。
              续写前建议重新分析，避免漏掉新事实。
            </p>
            <p v-else class="story-line">
              已记住 {{ bible.sourceChapters }} 章：{{ bibleStats.characters }} 个人物、{{ bibleStats.places }} 个地点、
              {{ openCount }} 条未回收伏笔，另有 {{ correctionCount }} 条作者纠正。
            </p>
          </div>
        </div>

        <div v-if="bibleReady" class="story-facts">
          <span><b class="mono">{{ bibleStats.events }}</b> 重要事件</span>
          <span><b class="mono">{{ bibleStats.timeline }}</b> 时间节点</span>
          <span><b class="mono">{{ correctionCount }}</b> 条纠正</span>
        </div>

        <button type="button" class="story-link" @click="bibleVisible = true">
          {{ bibleReady ? '查看记忆卡' : '建立记忆卡' }}
          <el-icon><ArrowRight /></el-icon>
        </button>
      </section>

      <div class="workspace-grid">
        <aside class="chapter-rail paper-card">
          <header class="rail-head">
            <div>
              <span class="section-kicker">章目</span>
              <strong>正文 {{ chapters.length }} 章</strong>
            </div>
            <el-button size="small" @click="importVisible = true">
              <el-icon><Plus /></el-icon>
              导入
            </el-button>
          </header>

          <div v-if="chapters.length" class="rail-list">
            <button
              v-for="chapter in chapters"
              :key="chapter.id"
              type="button"
              class="chapter-item"
              :class="{ active: chapter.id === selectedChapterId }"
              :aria-current="chapter.id === selectedChapterId ? 'page' : undefined"
              @click="selectChapterById(chapter.id)"
            >
              <span class="chapter-order">{{ chapter.orderLabel }}</span>
              <span class="chapter-name">{{ chapterDisplayTitle(chapter) }}</span>
              <span v-if="latestChapter && chapter.id === latestChapter.id" class="latest-chip">
                最新
              </span>
            </button>
          </div>
          <div v-else class="rail-empty">
            <span>还没有正文</span>
            <p>导入 .txt / .md，或直接粘贴第一章。</p>
          </div>

          <button type="button" class="rail-memory" @click="bibleVisible = true">
            <span class="rail-memory-mark">记</span>
            <span class="rail-memory-copy">
              <strong>{{ bibleReady ? '故事记忆卡' : '建立故事记忆卡' }}</strong>
              <small v-if="analyzing">正在分析章节…</small>
              <small v-else-if="bibleReady">{{ openCount }} 条伏笔未回收</small>
              <small v-else>人物 · 时间线 · 伏笔</small>
            </span>
            <el-icon><ArrowRight /></el-icon>
          </button>
        </aside>

        <div class="workspace-main">
          <article class="reading-card paper-card">
            <template v-if="selectedChapter">
              <header class="reading-head">
                <div>
                  <span class="section-kicker">
                    Manuscript · {{ selectedChapter.orderLabel }}
                  </span>
                  <h2>{{ selectedDisplayTitle }}</h2>
                  <p class="reading-meta">
                    <span>{{ chapterCharCount.toLocaleString('zh-CN') }} 字</span>
                    <i />
                    <span>导入于 {{ formatDateTime(selectedChapter.createdAt) }}</span>
                    <i />
                    <span>{{ isLatest ? '当前最新章节' : '历史章节，只读' }}</span>
                  </p>
                </div>
                <span class="saved-chip">已保存原文</span>
              </header>

              <div v-if="chapterLoading" class="reading-loading">
                <el-skeleton :rows="6" animated />
              </div>

              <div v-else-if="chapterError" class="reading-error">
                <p>{{ chapterError }}</p>
                <el-button size="small" @click="loadChapterContent(selectedChapterId, { force: true })">
                  重新读取
                </el-button>
              </div>

              <template v-else-if="chapterContent">
                <div class="reading-body" :class="{ expanded: readingExpanded }">
                  <p class="content-prose">{{ chapterContent.content }}</p>
                  <div v-if="canCollapse && !readingExpanded" class="reading-fade" />
                </div>
                <button
                  v-if="canCollapse"
                  type="button"
                  class="reading-expand"
                  @click="readingExpanded = !readingExpanded"
                >
                  {{ readingExpanded ? '收起正文' : '展开全文' }}
                  <el-icon>
                    <ArrowUp v-if="readingExpanded" />
                    <ArrowDown v-else />
                  </el-icon>
                </button>
              </template>
            </template>

            <div v-else class="reading-empty">
              <span class="seal empty-seal">章</span>
              <p class="eyebrow plain">First chapter</p>
              <h2>先把已有章节放进来</h2>
              <p>
                上传或粘贴 2–3 章已有正文。系统只读取这份原文，不会改写；
                首次导入后会自动提取人物、时间线、世界观和未回收伏笔。
              </p>
              <el-button type="primary" size="large" @click="importVisible = true">
                <el-icon><UploadFilled /></el-icon>
                导入第一章
              </el-button>
              <span class="empty-foot">支持 .txt / .md · 单章最多 20 万字符</span>
            </div>
          </article>

          <section v-if="selectedChapter && !isLatest" class="history-card paper-card">
            <div>
              <span class="section-kicker">History</span>
              <h2>正在回看{{ selectedChapter.orderLabel }}</h2>
              <p>续写只从最新章节继续，避免把历史内容误当成当前进度。</p>
            </div>
            <el-button type="primary" @click="selectChapterById(latestChapter.id)">
              回到{{ latestChapter.orderLabel }}
            </el-button>
          </section>

          <section v-else-if="selectedChapter" class="composer paper-card">
            <header class="composer-head">
              <div>
                <span class="section-kicker">Continue</span>
                <h2>续写第{{ nextOrder }}章</h2>
                <p>
                  以{{ latestChapter.orderLabel }}为起点，结合故事记忆卡与你的笔迹，
                  先给候选，不自动写入作品。
                </p>
              </div>
              <span class="composer-status">
                <i :class="{ ready: canGenerate }" />
                {{ analyzing ? '恢复故事记忆中' : canGenerate ? '可以开始续写' : '还需准备' }}
              </span>
            </header>

            <div v-if="!bibleReady || bibleStale" class="composer-blocker">
              <div class="blocker-copy">
                <span class="blocker-mark">!</span>
                <div>
                  <strong v-if="!bibleReady">续写前，先让模型读懂已有章节</strong>
                  <strong v-else>故事记忆卡还没有覆盖最新章节</strong>
                  <p v-if="!bibleReady">
                    系统会从你导入的正文中提取人物关系、地点、世界规则、时间线、事件与未回收伏笔。
                  </p>
                  <p v-else>
                    重新分析会把最近 {{ bibleStaleCount }} 章的新事实并入记忆卡，避免续写漏掉关键信息。
                  </p>
                </div>
              </div>
              <el-button :loading="analyzing" @click="analyzeBible()">
                {{ analyzing ? '正在分析…' : bibleReady ? '重新分析最新章节' : '生成故事记忆卡' }}
              </el-button>
            </div>

            <div class="composer-form">
              <label class="field span-2">
                <span class="field-label">
                  续写要求
                  <small>这一章要发生什么、信息揭示到什么程度</small>
                </span>
                <el-input
                  v-model="form.requirements"
                  type="textarea"
                  :autosize="{ minRows: 4, maxRows: 8 }"
                  maxlength="3000"
                  show-word-limit
                  resize="none"
                  placeholder="比如：续写下一章，要求主角发现线索但不要揭露真相。保持港口悬疑的克制感。"
                />
              </label>

              <label class="field span-2">
                <span class="field-label">
                  剧情方向
                  <small>可选</small>
                </span>
                <el-input
                  v-model="form.plotDirection"
                  maxlength="500"
                  placeholder="比如：让主角先找到一件能验证信件的物证，但暂时不要与周砚摊牌。"
                />
              </label>

              <div class="field">
                <span class="field-label length-label">
                  期望续写长度
                  <strong class="mono">{{ form.targetLength }} 字</strong>
                </span>
                <el-slider
                  v-model="form.targetLength"
                  :min="400"
                  :max="3000"
                  :step="100"
                  :show-tooltip="false"
                />
                <div class="length-presets">
                  <button
                    v-for="preset in lengthPresets"
                    :key="preset"
                    type="button"
                    :class="{ active: form.targetLength === preset }"
                    @click="form.targetLength = preset"
                  >
                    {{ preset }}
                  </button>
                </div>
              </div>

              <label class="field">
                <span class="field-label">叙事视角</span>
                <el-select v-model="form.narrator" style="width: 100%">
                  <el-option
                    v-for="item in narratorOptions"
                    :key="item.key"
                    :label="item.label"
                    :value="item.key"
                  />
                </el-select>
                <span class="field-hint">
                  {{ narratorHint }}
                </span>
              </label>

              <div class="strict-row span-2">
                <div>
                  <strong>严格遵守已有设定</strong>
                  <p>
                    人物不能突然知道他不该知道的事；时间线、地点规则和已经发生的事实不能推翻。
                  </p>
                </div>
                <el-switch v-model="form.strictSettings" />
              </div>

              <p class="context-note span-2">
                <el-icon><Lock /></el-icon>
                本轮只读取当前作品的故事记忆卡、最近章节原文和更早章节摘要，不会读取其他账号的作品。
                要求有修改时，候选不会自动更新，需要重新生成。
              </p>
            </div>

            <footer class="composer-actions">
              <span>
                将生成 {{ expectedCandidates }} 个方向不同的候选。候选不会自动覆盖任何章节。
              </span>
              <el-button
                type="primary"
                size="large"
                :loading="generating"
                :disabled="!canGenerate"
                @click="generate"
              >
                <el-icon v-if="!generating"><MagicStick /></el-icon>
                {{ generating ? '正在续写…' : '生成续写候选' }}
              </el-button>
            </footer>
          </section>

          <section v-if="generating" class="generating-card paper-card">
            <span class="generating-seal">候</span>
            <div>
              <p class="section-kicker">Composing</p>
              <h3>正在把当前章节接下去</h3>
              <p>
                模型会先读故事记忆卡与笔迹，再写 {{ expectedCandidates }} 个方向不同的候选。
                这一段通常需要几十秒，请不要重复点击。
              </p>
            </div>
          </section>

          <section v-if="candidates.length" id="candidate-results" class="candidate-results">
            <header class="results-head">
              <div>
                <span class="section-kicker">Candidates</span>
                <h2>本轮续写候选</h2>
                <p class="results-meta">
                  <template v-if="generationMeta">
                    基于{{ generationMeta.currentChapter?.orderLabel || latestChapter.orderLabel }} ·
                    {{ generationMeta.narratorLabel }} ·
                    {{ generationMeta.targetLength }} 字/稿
                    <template v-if="generationMeta.styleProfile">
                      · 笔迹「{{ generationMeta.styleProfile.name }}」
                    </template>
                  </template>
                  候选只留在当前页面；保留不等于写入作品。
                </p>
              </div>
              <div class="results-count">
                <strong class="mono">{{ candidates.length }}</strong>
                <span>稿候选</span>
              </div>
            </header>

            <article
              v-for="(candidate, index) in candidates"
              :key="`${candidate.id}-${index}`"
              class="candidate-card paper-card"
            >
              <header class="candidate-head">
                <span class="candidate-letter">{{ candidateLetters[index] || index + 1 }}</span>
                <div class="candidate-heading">
                  <span class="candidate-direction">{{ candidate.direction }}</span>
                  <h3>{{ candidate.title }}</h3>
                </div>
                <div class="candidate-badges">
                  <span v-if="candidate.kept" class="kept-chip">已保留</span>
                  <span
                    v-if="candidate.consistency"
                    class="score-chip mono"
                    :class="{ poor: !candidate.consistency.passed }"
                  >
                    一致性 {{ candidate.consistency.overallScore }}
                  </span>
                  <span class="char-chip mono">{{ candidate.charCount }} 字</span>
                </div>
              </header>

              <p class="candidate-summary">{{ candidate.summary }}</p>

              <div class="candidate-copy" :class="{ expanded: candidate.expanded }">
                <p class="candidate-text">{{ candidate.content }}</p>
                <div v-if="!candidate.expanded && candidate.charCount > 520" class="candidate-fade" />
              </div>

              <button
                v-if="candidate.charCount > 520"
                type="button"
                class="candidate-expand"
                @click="candidate.expanded = !candidate.expanded"
              >
                {{ candidate.expanded ? '收起正文' : '展开全文' }}
                <el-icon>
                  <ArrowUp v-if="candidate.expanded" />
                  <ArrowDown v-else />
                </el-icon>
              </button>

              <footer class="candidate-actions">
                <el-button text @click="openConsistency(candidate)">
                  <el-icon><DataAnalysis /></el-icon>
                  {{ candidate.consistency ? '再看一致性' : '检查一致性' }}
                </el-button>
                <el-button text @click="toggleKeep(candidate)">
                  <el-icon><CollectionTag /></el-icon>
                  {{ candidate.kept ? '取消保留' : '保留候选' }}
                </el-button>
                <span class="action-spacer" />
                <el-button
                  :disabled="savingAdopt"
                  @click="openEditCandidate(candidate)"
                >
                  编辑后采用
                </el-button>
                <el-button
                  type="primary"
                  :loading="adoptingCandidateId === candidate.id"
                  :disabled="savingAdopt && adoptingCandidateId !== candidate.id"
                  @click="adoptCandidate(candidate)"
                >
                  采用并保存
                </el-button>
              </footer>
            </article>
          </section>
        </div>
      </div>
    </template>

    <ChapterImportDialog
      v-model="importVisible"
      :submitting="importing"
      :demo-title="demoNovel?.title || ''"
      :demo-chapters="isDemoNovel ? demoNovel?.chapters || [] : []"
      :next-chapter-number="nextOrder"
      @submit="importChapters"
    />

    <NovelFormDialog
      v-model="settingsVisible"
      mode="edit"
      :novel="novel"
      :profiles="profiles"
      :narrators="narratorOptions"
      :submitting="savingSettings"
      @submit="saveSettings"
    />

    <NovelBibleDrawer
      v-if="novel"
      v-model="bibleVisible"
      :novel-id="novel.id"
      :bible="novel.bible"
      :analyzing="analyzing"
      :has-chapters="chapters.length > 0"
      :correction-types="meta.correctionTypes || []"
      @analyze="analyzeBible()"
      @updated="handleBibleUpdated"
    />

    <NovelAssistantDrawer
      v-if="novel"
      v-model="assistantVisible"
      :novel-id="novel.id"
      :novel-title="novel.title"
    />

    <el-dialog
      v-model="consistencyVisible"
      title="一致性检查"
      width="min(880px, 95vw)"
      class="consistency-dialog"
      :close-on-click-modal="false"
    >
      <div v-if="consistencyLoading" class="checking-state">
        <span class="checking-mark">校</span>
        <div>
          <strong>正在逐条比对故事记忆卡</strong>
          <p>
            检查人物认知、关系、时间线、世界规则、伏笔处理和文风贴近度，
            并标出具体段落。请稍候。
          </p>
        </div>
      </div>

      <div v-else-if="consistencyError" class="consistency-error">
        <span class="checking-mark">!</span>
        <div>
          <strong>这次没有检查完</strong>
          <p>{{ consistencyError }}</p>
        </div>
      </div>

      <ConsistencyReport
        v-else-if="consistencyReport"
        :report="consistencyReport"
        :title="consistencyCandidate?.title || ''"
        :char-count="consistencyCandidate?.charCount || 0"
      />

      <template #footer>
        <div class="dialog-foot">
          <span class="dialog-note">检查结果不会写入作品，也不会自动修改候选正文。</span>
          <div>
            <el-button @click="consistencyVisible = false">关闭</el-button>
            <el-button
              v-if="consistencyError"
              :loading="consistencyLoading"
              @click="runConsistency(true)"
            >
              重新检查
            </el-button>
            <el-button
              :disabled="consistencyLoading || !consistencyCandidate"
              @click="editFromConsistency"
            >
              编辑这一稿
            </el-button>
            <el-button
              type="primary"
              :disabled="consistencyLoading || !consistencyCandidate"
              :loading="savingAdopt"
              @click="adoptCandidate(consistencyCandidate)"
            >
              采用并保存
            </el-button>
          </div>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="editVisible"
      title="编辑候选稿"
      width="min(780px, 95vw)"
      class="candidate-edit-dialog"
      :close-on-click-modal="false"
    >
      <div class="edit-body">
        <label class="field">
          <span class="field-label">
            章节标题
            <small>{{ editForm.title.length }}/120</small>
          </span>
          <el-input
            v-model="editForm.title"
            maxlength="120"
            placeholder="给这一章起标题，不必写“第几章”"
          />
        </label>
        <label class="field">
          <span class="field-label">
            正文
            <small>{{ editCharCount.toLocaleString('zh-CN') }} 字</small>
          </span>
          <el-input
            v-model="editForm.content"
            type="textarea"
            :autosize="{ minRows: 14, maxRows: 20 }"
            maxlength="200000"
            resize="none"
          />
        </label>
        <p class="edit-note">
          保存会把修改后的正文作为新章节追加到作品末尾，不覆盖已有章节。
          <template v-if="editingCandidate?.consistency">
            原一致性检查基于修改前的正文，修改后可能需要重新检查。
          </template>
        </p>
      </div>
      <template #footer>
        <div class="dialog-foot">
          <span class="dialog-note">只会追加到这本小说，不会出现在“我的文章”里。</span>
          <div>
            <el-button @click="editVisible = false">取消</el-button>
            <el-button type="primary" :loading="savingAdopt" @click="submitEditedCandidate">
              采用并保存
            </el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import WritingModeSwitch from '../components/WritingModeSwitch.vue';
import ChapterImportDialog from '../components/ChapterImportDialog.vue';
import NovelFormDialog from '../components/NovelFormDialog.vue';
import NovelBibleDrawer from '../components/NovelBibleDrawer.vue';
import NovelAssistantDrawer from '../components/NovelAssistantDrawer.vue';
import ConsistencyReport from '../components/ConsistencyReport.vue';
import { metaApi, novelApi, profileApi } from '../api';
import { chapterDisplayTitle, countChars, formatDateTime } from '../utils/format';

const route = useRoute();
const router = useRouter();

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
    hint: '叙述者知道多个人物的处境，但不要随意泄露所有底牌。',
  },
  { key: 'dual', label: '双视角交替', hint: '在两个主要人物的有限视角之间切换。' },
];

const lengthPresets = [800, 1200, 1600, 2200];
const candidateLetters = ['A', 'B', 'C'];

const loading = ref(true);
const notFound = ref(false);
const loadError = ref('');
const novel = ref(null);
const meta = ref({ narrators: [], correctionTypes: [], limits: {} });
const demoNovel = ref(null);
const profiles = ref([]);

const selectedChapterId = ref(null);
const chapterContent = ref(null);
const chapterLoading = ref(false);
const chapterError = ref('');
const readingExpanded = ref(false);
const chapterCache = new Map();
let chapterRequestToken = 0;

const importVisible = ref(false);
const importing = ref(false);
const settingsVisible = ref(false);
const savingSettings = ref(false);
const bibleVisible = ref(false);
const assistantVisible = ref(false);
const analyzing = ref(false);

const form = reactive({
  requirements: '',
  plotDirection: '',
  targetLength: 1200,
  narrator: 'third-limited',
  strictSettings: true,
});
const draftHydrated = ref(false);
let draftTimer = null;

const generating = ref(false);
const candidates = ref([]);
const generationMeta = ref(null);

const consistencyVisible = ref(false);
const consistencyLoading = ref(false);
const consistencyError = ref('');
const consistencyReport = ref(null);
const consistencyCandidate = ref(null);

const editVisible = ref(false);
const editingCandidate = ref(null);
const editForm = reactive({ title: '', content: '' });
const savingAdopt = ref(false);
const adoptingCandidateId = ref(null);

const narratorOptions = computed(() =>
  meta.value.narrators?.length ? meta.value.narrators : fallbackNarrators
);

const narratorHint = computed(
  () =>
    narratorOptions.value.find((item) => item.key === form.narrator)?.hint ||
    '不同视角会改变人物信息边界。'
);

const chapters = computed(() => novel.value?.chapters || []);
const latestChapter = computed(() => chapters.value[chapters.value.length - 1] || null);
const selectedChapter = computed(
  () => chapters.value.find((chapter) => chapter.id === selectedChapterId.value) || null
);
const isLatest = computed(
  () =>
    Boolean(selectedChapter.value) &&
    Boolean(latestChapter.value) &&
    selectedChapter.value.id === latestChapter.value.id
);
const selectedDisplayTitle = computed(() =>
  selectedChapter.value ? chapterDisplayTitle(selectedChapter.value) : ''
);
const chapterCharCount = computed(() =>
  chapterContent.value ? countChars(chapterContent.value.content) : 0
);
const canCollapse = computed(() => chapterCharCount.value > 600);
const nextOrder = computed(() =>
  latestChapter.value ? Number(latestChapter.value.order) + 1 : 1
);
const bible = computed(() => novel.value?.bible || null);
const bibleReady = computed(() => Boolean(bible.value?.core));
const bibleStats = computed(() => {
  const core = bible.value?.core || {};
  return {
    characters: Array.isArray(core.characters) ? core.characters.length : 0,
    places: Array.isArray(core.places) ? core.places.length : 0,
    events: Array.isArray(core.events) ? core.events.length : 0,
    timeline: Array.isArray(core.timeline) ? core.timeline.length : 0,
  };
});
const openCount = computed(() => {
  if (Number.isFinite(Number(bible.value?.stats?.openForeshadowing))) {
    return Number(bible.value.stats.openForeshadowing);
  }
  return (bible.value?.core?.foreshadowing || []).filter((item) => item.status === 'open').length;
});
const correctionCount = computed(() => {
  if (Number.isFinite(Number(bible.value?.stats?.corrections))) {
    return Number(bible.value.stats.corrections);
  }
  return bible.value?.corrections?.notes?.length || 0;
});
const bibleStale = computed(
  () =>
    bibleReady.value &&
    Number(bible.value?.sourceChapters || 0) < chapters.value.length
);
const bibleStaleCount = computed(() =>
  Math.max(0, chapters.value.length - Number(bible.value?.sourceChapters || 0))
);
const canGenerate = computed(
  () =>
    chapters.value.length > 0 &&
    isLatest.value &&
    bibleReady.value &&
    !bibleStale.value &&
    !analyzing.value &&
    !generating.value
);
const expectedCandidates = computed(() => (Number(form.targetLength) > 1800 ? '2' : '3'));
const isDemoNovel = computed(
  () => Boolean(demoNovel.value?.title) && novel.value?.title === demoNovel.value.title
);
const editCharCount = computed(() => countChars(editForm.content));

function friendlyError(error, fallback = '请求失败，请稍后再试') {
  const code = error?.code;
  if (code === 'NO_API_KEY') {
    return '后端还没有配置模型 API Key。请在 backend/.env 中设置 LLM_API_KEY，保存后重启后端。章节原文不会丢失。';
  }
  if (code === 'BIBLE_NOT_READY') {
    return '请先分析章节，生成故事记忆卡。';
  }
  if (code === 'CHAPTER_NOT_LATEST') {
    return '续写只从最新章节继续。请回到最新一章后再生成。';
  }
  if (code === 'LLM_BAD_JSON') {
    return `${error.message || '模型返回格式不正确'}。可以再试一次；若反复失败，请缩短续写要求后重试。`;
  }
  if (code === 'LLM_ERROR') {
    return `模型调用失败：${error.message || '请稍后再试'}`;
  }
  return error?.message || fallback;
}

function reportError(error, fallback) {
  ElMessage({
    type: 'error',
    message: friendlyError(error, fallback),
    duration: 6500,
    showClose: true,
  });
}

function localDraftKey(novelId = novel.value?.id) {
  return novelId ? `biji_novel_continue_${novelId}` : '';
}

function persistDraftNow() {
  if (!novel.value) return;
  try {
    window.localStorage.setItem(
      localDraftKey(),
      JSON.stringify({
        requirements: form.requirements,
        plotDirection: form.plotDirection,
        targetLength: Number(form.targetLength) || 1200,
        narrator: form.narrator,
        strictSettings: Boolean(form.strictSettings),
      })
    );
  } catch {
    // 本地存储不可用时不影响续写；表单仍保留在内存中。
  }
}

function hydrateForm() {
  if (!novel.value) return;
  draftHydrated.value = false;

  const defaults = {
    requirements: '',
    plotDirection: '',
    targetLength: 1200,
    narrator: novel.value.narrator || 'third-limited',
    strictSettings: novel.value.strictSettings !== false,
  };

  if (isDemoNovel.value) {
    defaults.requirements = demoNovel.value?.requirements || '';
    defaults.plotDirection = demoNovel.value?.plotDirection || '';
    defaults.targetLength = Number(demoNovel.value?.targetLength) || 1200;
  }

  let stored = null;
  try {
    stored = JSON.parse(window.localStorage.getItem(localDraftKey()) || 'null');
  } catch {
    stored = null;
  }

  if (stored && typeof stored === 'object') {
    if (typeof stored.requirements === 'string') defaults.requirements = stored.requirements;
    if (typeof stored.plotDirection === 'string') defaults.plotDirection = stored.plotDirection;
    const storedLength = Number(stored.targetLength);
    if (Number.isFinite(storedLength)) {
      defaults.targetLength = Math.min(3000, Math.max(400, storedLength));
    }
    if (narratorOptions.value.some((item) => item.key === stored.narrator)) {
      defaults.narrator = stored.narrator;
    }
    if (typeof stored.strictSettings === 'boolean') {
      defaults.strictSettings = stored.strictSettings;
    }
  }

  Object.assign(form, defaults);
  draftHydrated.value = true;
}

watch(
  form,
  () => {
    if (!draftHydrated.value || !novel.value) return;
    window.clearTimeout(draftTimer);
    draftTimer = window.setTimeout(persistDraftNow, 250);
  },
  { deep: true }
);

async function loadChapterContent(chapterId, { force = false } = {}) {
  const id = Number(chapterId);
  if (!Number.isInteger(id) || id <= 0) return;

  selectedChapterId.value = id;
  readingExpanded.value = false;
  chapterError.value = '';
  const token = ++chapterRequestToken;

  if (!force && chapterCache.has(id)) {
    chapterContent.value = chapterCache.get(id);
    chapterLoading.value = false;
    return;
  }

  chapterLoading.value = true;
  chapterContent.value = null;
  try {
    const data = await novelApi.chapter(novel.value.id, id);
    if (token !== chapterRequestToken) return;
    chapterContent.value = data.chapter;
    chapterCache.set(id, data.chapter);
  } catch (error) {
    if (token !== chapterRequestToken) return;
    chapterContent.value = null;
    chapterError.value = friendlyError(error, '章节读取失败，请重试');
  } finally {
    if (token === chapterRequestToken) chapterLoading.value = false;
  }
}

function selectChapterById(chapterId) {
  if (Number(chapterId) === selectedChapterId.value && chapterContent.value) return;
  loadChapterContent(chapterId);
}

async function refreshNovel({ selectLatest = false, selectChapterId = null } = {}) {
  const data = await novelApi.detail(route.params.id);
  novel.value = data.novel;

  if (selectChapterId !== null) {
    await loadChapterContent(selectChapterId, { force: true });
    return;
  }
  if (selectLatest && latestChapter.value) {
    await loadChapterContent(latestChapter.value.id);
    return;
  }
  const stillThere = chapters.value.some(
    (chapter) => chapter.id === selectedChapterId.value
  );
  if (!stillThere) {
    if (latestChapter.value) await loadChapterContent(latestChapter.value.id);
    else {
      selectedChapterId.value = null;
      chapterContent.value = null;
    }
  }
}

async function load() {
  loading.value = true;
  notFound.value = false;
  loadError.value = '';
  draftHydrated.value = false;
  novel.value = null;
  selectedChapterId.value = null;
  chapterContent.value = null;
  chapterError.value = '';
  chapterCache.clear();
  chapterRequestToken += 1;
  candidates.value = [];
  generationMeta.value = null;
  consistencyVisible.value = false;
  consistencyCandidate.value = null;
  consistencyReport.value = null;
  consistencyError.value = '';
  editVisible.value = false;
  editingCandidate.value = null;
  draftHydrated.value = false;

  const shouldAutoAnalyze = route.query.analyze === '1';
  try {
    const [detail, metaData, demoData, profileData] = await Promise.all([
      novelApi.detail(route.params.id),
      novelApi.meta().catch(() => ({ narrators: [], correctionTypes: [], limits: {} })),
      metaApi.demo().catch(() => null),
      profileApi.list().catch(() => ({ profiles: [] })),
    ]);

    novel.value = detail.novel;
    meta.value = metaData || { narrators: [], correctionTypes: [], limits: {} };
    demoNovel.value = demoData?.novel || null;
    profiles.value = profileData?.profiles || [];

    hydrateForm();

    if (latestChapter.value) {
      await loadChapterContent(latestChapter.value.id);
    }
  } catch (error) {
    if (error?.status === 404) {
      notFound.value = true;
    } else {
      loadError.value = friendlyError(error, '作品加载失败，请检查后端服务');
    }
  } finally {
    loading.value = false;
  }

  if (shouldAutoAnalyze) {
    router.replace({ name: 'novel-workspace', params: { id: route.params.id } });
    if (novel.value && chapters.value.length && !bibleReady.value) {
      await analyzeBible({ auto: true });
    }
  }
}

async function importChapters(list) {
  if (importing.value) return;
  importing.value = true;
  try {
    const data = await novelApi.addChapters(novel.value.id, list);
    importVisible.value = false;

    const count = data.chapters?.length || list.length;
    ElMessage.success(`${count} 章原文已导入，章节内容未被改写。`);
    await refreshNovel({ selectLatest: true });

    if (!bibleReady.value) {
      ElMessage.info('正在从新章节提取故事记忆卡，请稍候。');
      void analyzeBible({ auto: true });
    } else {
      ElMessage.info('新章节还没有纳入故事记忆卡，续写前记得重新分析。');
    }
  } catch (error) {
    reportError(error, '章节导入失败');
  } finally {
    importing.value = false;
  }
}

async function analyzeBible({ auto = false } = {}) {
  if (analyzing.value) return;
  if (!chapters.value.length) {
    ElMessage.warning('请先导入至少一章正文');
    importVisible.value = true;
    return;
  }

  analyzing.value = true;
  try {
    const data = await novelApi.analyze(novel.value.id);
    novel.value.bible = data.bible;
    if (data.styleProfile) novel.value.styleProfile = data.styleProfile;

    if (data.styleProfileWarning) {
      ElMessage({
        type: 'warning',
        message: `故事记忆卡已生成。${data.styleProfileWarning.message}`,
        duration: 7000,
        showClose: true,
      });
    } else {
      ElMessage.success(
        auto ? '故事记忆卡与文风档案已自动生成。' : '故事记忆卡已更新。'
      );
    }
  } catch (error) {
    reportError(error, '故事记忆卡生成失败');
  } finally {
    analyzing.value = false;
  }
}

function handleBibleUpdated(nextBible) {
  if (novel.value && nextBible) novel.value.bible = nextBible;
}

async function saveSettings(payload) {
  if (savingSettings.value) return;
  savingSettings.value = true;
  try {
    const data = await novelApi.update(novel.value.id, payload);
    novel.value = {
      ...novel.value,
      ...data.novel,
      chapters: novel.value.chapters,
      bible: novel.value.bible,
    };
    settingsVisible.value = false;
    ElMessage.success('作品设置已保存。');
  } catch (error) {
    reportError(error, '作品设置保存失败');
  } finally {
    savingSettings.value = false;
  }
}

async function generate() {
  if (generating.value) return;
  if (!chapters.value.length) {
    ElMessage.warning('请先导入章节正文');
    return;
  }
  if (!bibleReady.value || bibleStale.value) {
    ElMessage.warning('请先让故事记忆卡覆盖最新章节');
    bibleVisible.value = true;
    return;
  }
  if (!isLatest.value) {
    ElMessage.warning('续写只从最新章节继续');
    return;
  }

  generating.value = true;
  const previousCandidates = candidates.value;
  const previousMeta = generationMeta.value;
  candidates.value = [];
  generationMeta.value = null;

  try {
    const data = await novelApi.continue(novel.value.id, {
      currentChapterId: latestChapter.value.id,
      requirements: form.requirements.trim(),
      plotDirection: form.plotDirection.trim(),
      targetLength: Number(form.targetLength),
      narrator: form.narrator,
      strictSettings: Boolean(form.strictSettings),
    });

    candidates.value = (data.candidates || []).map((candidate) => ({
      ...candidate,
      expanded: false,
      kept: false,
      consistency: null,
    }));
    generationMeta.value = {
      ...data.meta,
      ...data.context,
      nextOrder: data.nextOrder,
    };
    ElMessage.success(`已生成 ${candidates.value.length} 个续写候选。`);
    await nextTick();
    document
      .getElementById('candidate-results')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    candidates.value = previousCandidates;
    generationMeta.value = previousMeta;
    reportError(error, '续写候选生成失败');
  } finally {
    generating.value = false;
  }
}

function toggleKeep(candidate) {
  candidate.kept = !candidate.kept;
}

function openConsistency(candidate) {
  consistencyCandidate.value = candidate;
  consistencyVisible.value = true;
  consistencyError.value = '';

  if (candidate.consistency) {
    consistencyReport.value = candidate.consistency;
    consistencyLoading.value = false;
    return;
  }
  consistencyReport.value = null;
  void runConsistency(false);
}

async function runConsistency(force = false) {
  const candidate = consistencyCandidate.value;
  if (!candidate || consistencyLoading.value) return;
  if (candidate.consistency && !force) {
    consistencyReport.value = candidate.consistency;
    return;
  }

  consistencyLoading.value = true;
  consistencyError.value = '';
  consistencyReport.value = null;
  try {
    const data = await novelApi.consistency(novel.value.id, {
      title: candidate.title,
      content: candidate.content,
    });
    candidate.consistency = data.consistency;
    consistencyReport.value = data.consistency;
  } catch (error) {
    consistencyError.value = friendlyError(error, '一致性检查失败');
  } finally {
    consistencyLoading.value = false;
  }
}

function editFromConsistency() {
  const candidate = consistencyCandidate.value;
  if (!candidate) return;
  consistencyVisible.value = false;
  openEditCandidate(candidate);
}

function openEditCandidate(candidate) {
  editingCandidate.value = candidate;
  editForm.title = candidate.title || `续写第${nextOrder.value}章`;
  editForm.content = candidate.content || '';
  editVisible.value = true;
}

async function submitEditedCandidate() {
  const content = editForm.content.trim();
  if (content.length < 80) {
    ElMessage.warning('正文至少需要 80 个字');
    return;
  }
  await adoptCandidate(editingCandidate.value, {
    title: editForm.title.trim() || `续写第${nextOrder.value}章`,
    content,
  });
}

function resetContinuationForm() {
  form.requirements = '';
  form.plotDirection = '';
  form.narrator = novel.value?.narrator || 'third-limited';
  form.strictSettings = novel.value?.strictSettings !== false;
  draftHydrated.value = true;
  persistDraftNow();
}

async function adoptCandidate(candidate, override = null) {
  if (!candidate || savingAdopt.value) return;
  const title =
    String(override?.title ?? candidate.title ?? '').trim() ||
    `续写第${nextOrder.value}章`;
  const content = String(override?.content ?? candidate.content ?? '').trim();
  if (content.length < 80) {
    ElMessage.warning('正文至少需要 80 个字');
    return;
  }

  let consistencyNote = '这一稿还没有做一致性检查。';
  if (candidate.consistency) {
    consistencyNote = candidate.consistency.passed
      ? '一致性检查没有发现明显冲突。'
      : `一致性检查仍提示 ${candidate.consistency.issues.length} 处问题。`;
  }

  try {
    await ElMessageBox.confirm(
      `把「${title}」作为第${nextOrder.value}章追加到《${novel.value.title}》。${consistencyNote}已有 ${chapters.value.length} 章不会被覆盖。`,
      '采用为新章节',
      {
        confirmButtonText: '采用并保存',
        cancelButtonText: '再看看',
        type: candidate.consistency && !candidate.consistency.passed ? 'warning' : 'info',
      }
    );
  } catch {
    return;
  }

  savingAdopt.value = true;
  adoptingCandidateId.value = candidate.id;
  let addedChapter = null;

  try {
    const data = await novelApi.addChapters(novel.value.id, [{ title, content }]);
    addedChapter = data.chapters?.[0] || null;
  } catch (error) {
    reportError(error, '采用失败，候选稿仍保留在页面中');
    savingAdopt.value = false;
    adoptingCandidateId.value = null;
    return;
  }

  consistencyVisible.value = false;
  editVisible.value = false;
  candidates.value = [];
  generationMeta.value = null;
  resetContinuationForm();
  ElMessage.success(
    addedChapter
      ? `${addedChapter.orderLabel}「${chapterDisplayTitle(addedChapter)}」已保存。`
      : '新章节已保存。'
  );

  try {
    await refreshNovel({ selectChapterId: addedChapter?.id || null });
    if (!addedChapter?.id) await refreshNovel({ selectLatest: true });
  } catch (error) {
    reportError(error, '新章节已保存，但工作台刷新失败，请刷新页面查看');
  } finally {
    savingAdopt.value = false;
    adoptingCandidateId.value = null;
  }
}

function goBack() {
  router.push({ name: 'novels' });
}

watch(
  () => route.params.id,
  () => {
    if (route.name === 'novel-workspace') load();
  }
);

onMounted(load);
onBeforeUnmount(() => {
  window.clearTimeout(draftTimer);
  chapterRequestToken += 1;
});
</script>

<style scoped>
.workspace-page {
  max-width: 1360px;
}

.workspace-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 18px;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 10px;
  cursor: pointer;
  transition: color 0.2s ease;
}

.back-link:hover {
  color: var(--vermilion);
}

.topline-note {
  color: var(--muted-soft);
  font-size: 9px;
  letter-spacing: 0.04em;
}

.workspace-loading {
  padding: 32px;
}

.load-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 72px 32px;
  text-align: center;
}

.load-error h1 {
  margin-top: 18px;
  font-size: 26px;
}

.load-error p {
  max-width: 480px;
  margin: 10px 0 22px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.8;
}

.novel-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 28px;
  margin: 24px 0 26px;
}

.novel-title-wrap {
  min-width: 0;
}

.title-line {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.title-line .eyebrow {
  margin-top: 2px;
}

.title-seal {
  flex: none;
  margin-top: 1px;
  font-size: 17px;
}

.novel-title {
  margin-top: 8px;
  font-family: var(--font-serif);
  font-size: clamp(32px, 4vw, 46px);
  font-weight: 600;
  letter-spacing: -0.035em;
  line-height: 1.15;
  word-break: break-word;
}

.novel-desc {
  display: -webkit-box;
  max-width: 680px;
  margin-top: 12px;
  overflow: hidden;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.85;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.novel-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 12px;
}

.novel-tags span {
  padding: 2px 7px;
  border: 1px solid var(--line);
  border-radius: 2px;
  color: var(--muted-soft);
  font-size: 8.5px;
}

.novel-tags .tag-strict {
  border-color: rgba(69, 100, 82, 0.24);
  color: var(--jade);
}

.novel-tags .tag-pending {
  border-color: rgba(155, 123, 66, 0.24);
  color: var(--gold);
}

.head-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  flex: none;
}

.head-actions .el-button {
  margin-left: 0;
}

.action-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 17px;
  height: 17px;
  margin-left: 2px;
  padding: 0 4px;
  border-radius: 999px;
  background: rgba(185, 65, 43, 0.1);
  color: var(--vermilion);
  font-size: 8px;
}

.story-band {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 14px 18px;
  border-left: 2px solid var(--jade);
}

.story-band.attention {
  border-left-color: var(--gold);
  background: rgba(255, 250, 238, 0.72);
}

.story-state {
  display: flex;
  align-items: center;
  flex: 1;
  gap: 12px;
  min-width: 0;
}

.story-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 30px;
  height: 30px;
  border: 1px solid rgba(69, 100, 82, 0.32);
  border-radius: 50%;
  color: var(--jade);
  font-family: var(--font-serif);
  font-size: 14px;
}

.story-band.attention .story-mark {
  border-color: rgba(155, 123, 66, 0.35);
  color: var(--gold);
}

.story-copy {
  min-width: 0;
}

.story-kicker {
  color: var(--muted-soft);
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.story-line {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 3px;
  color: var(--ink-soft);
  font-size: 10.5px;
  line-height: 1.65;
}

.story-facts {
  display: flex;
  align-items: center;
  gap: 18px;
  color: var(--muted-soft);
  font-size: 8.5px;
  white-space: nowrap;
}

.story-facts b {
  color: var(--ink-soft);
  font-weight: 600;
}

.story-link {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex: none;
  margin-left: auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--vermilion);
  font-size: 9.5px;
  cursor: pointer;
}

.story-link .el-icon {
  font-size: 10px;
}

.workspace-grid {
  display: grid;
  grid-template-columns: 236px minmax(0, 1fr);
  align-items: start;
  gap: 17px;
  margin-top: 17px;
}

.chapter-rail {
  position: sticky;
  top: 24px;
  overflow: hidden;
}

.rail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 15px 14px 12px;
  border-bottom: 1px solid var(--line);
}

.rail-head strong {
  display: block;
  margin-top: 2px;
  font-family: var(--font-serif);
  font-size: 14px;
  font-weight: 600;
}

.rail-head :deep(.el-button) {
  padding: 5px 8px;
  font-size: 9.5px;
}

.rail-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 520px;
  overflow-y: auto;
  padding: 7px;
}

.rail-list::-webkit-scrollbar {
  width: 4px;
}

.chapter-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 9px 9px;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease;
}

.chapter-item:hover {
  background: rgba(255, 253, 248, 0.7);
}

.chapter-item.active {
  border-color: rgba(185, 65, 43, 0.18);
  background: rgba(185, 65, 43, 0.065);
}

.chapter-order {
  color: var(--muted-soft);
  font-size: 8px;
  white-space: nowrap;
}

.chapter-item.active .chapter-order {
  color: var(--vermilion);
}

.chapter-name {
  overflow: hidden;
  color: var(--ink-soft);
  font-family: var(--font-serif);
  font-size: 11.5px;
  font-weight: 500;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chapter-item.active .chapter-name {
  color: var(--ink);
  font-weight: 600;
}

.latest-chip {
  padding: 1px 4px;
  border-radius: 2px;
  background: rgba(69, 100, 82, 0.08);
  color: var(--jade);
  font-size: 7px;
}

.rail-empty {
  padding: 30px 18px;
  text-align: center;
}

.rail-empty span {
  color: var(--muted);
  font-family: var(--font-serif);
  font-size: 12px;
}

.rail-empty p {
  margin-top: 3px;
  color: var(--muted-soft);
  font-size: 8.5px;
  line-height: 1.6;
}

.rail-memory {
  display: flex;
  align-items: center;
  gap: 9px;
  width: calc(100% - 14px);
  margin: 3px 7px 7px;
  padding: 10px 9px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: rgba(255, 253, 248, 0.46);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.rail-memory:hover {
  border-color: var(--line-strong);
}

.rail-memory-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 24px;
  height: 24px;
  border: 1px solid rgba(69, 100, 82, 0.25);
  border-radius: 50%;
  color: var(--jade);
  font-family: var(--font-serif);
  font-size: 11px;
}

.rail-memory-copy {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}

.rail-memory-copy strong {
  font-family: var(--font-serif);
  font-size: 10.5px;
  font-weight: 600;
}

.rail-memory-copy small {
  overflow: hidden;
  color: var(--muted-soft);
  font-size: 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rail-memory > .el-icon {
  color: var(--muted-soft);
  font-size: 10px;
}

.workspace-main {
  display: flex;
  flex-direction: column;
  gap: 15px;
  min-width: 0;
}

.reading-card {
  padding: 24px 26px 20px;
}

.reading-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding-bottom: 15px;
  border-bottom: 1px solid var(--line);
}

.reading-head h2 {
  margin-top: 1px;
  font-family: var(--font-serif);
  font-size: 23px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.35;
}

.reading-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 5px;
  color: var(--muted-soft);
  font-size: 8.5px;
}

.reading-meta i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--line-strong);
}

.saved-chip {
  flex: none;
  padding: 2px 6px;
  border: 1px solid rgba(69, 100, 82, 0.22);
  border-radius: 2px;
  color: var(--jade);
  font-size: 8px;
}

.reading-body {
  position: relative;
  max-height: 390px;
  margin-top: 18px;
  padding-left: 22px;
  overflow: hidden;
  border-left: 1px solid var(--line);
}

.reading-body.expanded {
  max-height: none;
  overflow: visible;
}

.reading-body :deep(.content-prose) {
  font-size: 15.5px;
  line-height: 2;
}

.reading-fade {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 94px;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(255, 253, 248, 0), rgba(255, 253, 248, 0.96) 76%);
}

.reading-expand,
.candidate-expand {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-top: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--vermilion);
  font-size: 9.5px;
  cursor: pointer;
}

.reading-loading,
.reading-error {
  padding-top: 20px;
}

.reading-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  color: var(--vermilion);
  font-size: 10.5px;
}

.reading-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 56px 26px 48px;
  text-align: center;
}

.empty-seal {
  margin-bottom: 17px;
}

.reading-empty h2 {
  margin-top: 10px;
  font-size: 24px;
}

.reading-empty > p:not(.eyebrow) {
  max-width: 490px;
  margin: 10px 0 20px;
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.85;
}

.empty-foot {
  margin-top: 12px;
  color: var(--muted-soft);
  font-size: 8.5px;
}

.history-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22px;
  padding: 20px 24px;
}

.history-card h2 {
  margin-top: 2px;
  font-size: 19px;
}

.history-card p {
  margin-top: 5px;
  color: var(--muted);
  font-size: 10.5px;
  line-height: 1.7;
}

.composer {
  padding: 24px 26px;
}

.composer-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.composer-head h2 {
  font-size: 23px;
  letter-spacing: -0.02em;
}

.composer-head p:not(.section-kicker) {
  margin-top: 5px;
  color: var(--muted);
  font-size: 10.5px;
  line-height: 1.7;
}

.composer-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: none;
  padding-top: 3px;
  color: var(--muted-soft);
  font-size: 9px;
}

.composer-status i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--gold);
}

.composer-status i.ready {
  background: var(--jade);
}

.composer-blocker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-top: 16px;
  padding: 12px 14px;
  border: 1px solid rgba(155, 123, 66, 0.22);
  border-radius: 6px;
  background: rgba(155, 123, 66, 0.045);
}

.blocker-copy {
  display: flex;
  align-items: flex-start;
  gap: 9px;
}

.blocker-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 19px;
  height: 19px;
  border: 1px solid rgba(155, 123, 66, 0.4);
  border-radius: 50%;
  color: var(--gold);
  font-family: var(--font-serif);
  font-size: 11px;
}

.blocker-copy strong {
  font-family: var(--font-serif);
  font-size: 11.5px;
  font-weight: 600;
}

.blocker-copy p {
  margin-top: 2px;
  color: var(--muted);
  font-size: 9px;
  line-height: 1.6;
}

.composer-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
  margin-top: 18px;
}

.span-2 {
  grid-column: span 2;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.field-label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  color: var(--ink-soft);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.field-label small {
  color: var(--muted-soft);
  font-size: 8.5px;
  font-weight: 400;
  letter-spacing: 0;
}

.field-hint {
  color: var(--muted-soft);
  font-size: 8.5px;
  line-height: 1.6;
}

.length-label strong {
  color: var(--vermilion);
  font-size: 10.5px;
  font-weight: 600;
}

.length-presets {
  display: flex;
  gap: 5px;
}

.length-presets button {
  padding: 2px 7px;
  border: 1px solid var(--line);
  border-radius: 3px;
  background: transparent;
  color: var(--muted-soft);
  font-size: 8px;
  cursor: pointer;
}

.length-presets button:hover,
.length-presets button.active {
  border-color: rgba(185, 65, 43, 0.32);
  color: var(--vermilion);
}

.strict-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: rgba(255, 253, 248, 0.48);
}

.strict-row strong {
  font-family: var(--font-serif);
  font-size: 11px;
  font-weight: 600;
}

.strict-row p {
  margin-top: 2px;
  color: var(--muted-soft);
  font-size: 8.5px;
  line-height: 1.6;
}

.strict-row .el-switch {
  flex: none;
}

.context-note {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  color: var(--muted-soft);
  font-size: 8.5px;
  line-height: 1.7;
}

.context-note .el-icon {
  flex: none;
  margin-top: 2px;
  font-size: 10px;
}

.composer-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-top: 17px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}

.composer-actions > span {
  color: var(--muted-soft);
  font-size: 8.5px;
  line-height: 1.6;
}

.generating-card {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 24px 26px;
}

.generating-seal {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 39px;
  height: 39px;
  border: 1px solid rgba(185, 65, 43, 0.28);
  border-radius: 50%;
  color: var(--vermilion);
  font-family: var(--font-serif);
  font-size: 17px;
  animation: breathe 2s ease-in-out infinite;
}

.generating-card h3 {
  margin-top: 1px;
  font-size: 18px;
}

.generating-card p:not(.section-kicker) {
  max-width: 620px;
  margin-top: 5px;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.7;
}

.candidate-results {
  display: flex;
  flex-direction: column;
  gap: 12px;
  scroll-margin-top: 20px;
}

.results-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding: 17px 2px 3px;
}

.results-head h2 {
  margin-top: 2px;
  font-size: 23px;
}

.results-meta {
  margin-top: 5px;
  color: var(--muted-soft);
  font-size: 8.5px;
  line-height: 1.7;
}

.results-count {
  display: flex;
  align-items: baseline;
  gap: 4px;
  flex: none;
  padding-bottom: 3px;
  color: var(--muted-soft);
}

.results-count strong {
  color: var(--vermilion);
  font-family: var(--font-serif);
  font-size: 25px;
  font-weight: 600;
}

.results-count span {
  font-size: 8.5px;
}

.candidate-card {
  padding: 19px 21px 12px;
}

.candidate-head {
  display: flex;
  align-items: flex-start;
  gap: 11px;
}

.candidate-letter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 27px;
  height: 27px;
  border: 1px solid rgba(185, 65, 43, 0.28);
  border-radius: 3px;
  color: var(--vermilion);
  font-family: var(--font-serif);
  font-size: 13px;
}

.candidate-heading {
  min-width: 0;
  flex: 1;
}

.candidate-direction {
  display: block;
  color: var(--gold);
  font-size: 8px;
  letter-spacing: 0.02em;
}

.candidate-heading h3 {
  margin-top: 2px;
  font-size: 18px;
  line-height: 1.4;
}

.candidate-badges {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 5px;
  flex: none;
  padding-top: 1px;
}

.kept-chip,
.score-chip,
.char-chip {
  padding: 2px 5px;
  border: 1px solid var(--line);
  border-radius: 2px;
  color: var(--muted-soft);
  font-size: 8px;
  white-space: nowrap;
}

.kept-chip {
  border-color: rgba(69, 100, 82, 0.22);
  color: var(--jade);
}

.score-chip {
  border-color: rgba(69, 100, 82, 0.22);
  color: var(--jade);
}

.score-chip.poor {
  border-color: rgba(185, 65, 43, 0.25);
  color: var(--vermilion);
}

.candidate-summary {
  margin: 11px 0 0 38px;
  padding-left: 10px;
  border-left: 1px solid var(--line-strong);
  color: var(--muted);
  font-size: 9.5px;
  line-height: 1.75;
}

.candidate-copy {
  position: relative;
  margin-top: 11px;
  padding-left: 38px;
  max-height: 290px;
  overflow: hidden;
}

.candidate-copy.expanded {
  max-height: none;
  overflow: visible;
}

.candidate-text {
  color: var(--ink-soft);
  font-family: var(--font-serif);
  font-size: 13.5px;
  line-height: 1.96;
  white-space: pre-wrap;
  word-break: break-word;
}

.candidate-fade {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 38px;
  height: 78px;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(255, 253, 248, 0), rgba(255, 253, 248, 0.97) 78%);
}

.candidate-expand {
  margin-left: 38px;
}

.candidate-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 12px;
  padding-top: 9px;
  border-top: 1px solid var(--line);
}

.candidate-actions :deep(.el-button) {
  margin-left: 0;
  font-size: 9.5px;
}

.action-spacer {
  flex: 1;
}

.checking-state,
.consistency-error {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  min-height: 130px;
  padding: 22px 4px;
}

.checking-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 34px;
  height: 34px;
  border: 1px solid rgba(155, 123, 66, 0.35);
  border-radius: 50%;
  color: var(--gold);
  font-family: var(--font-serif);
  font-size: 15px;
  animation: breathe 1.8s ease-in-out infinite;
}

.consistency-error .checking-mark {
  border-color: rgba(185, 65, 43, 0.35);
  color: var(--vermilion);
  animation: none;
}

.checking-state strong,
.consistency-error strong {
  font-family: var(--font-serif);
  font-size: 14px;
  font-weight: 600;
}

.checking-state p,
.consistency-error p {
  max-width: 570px;
  margin-top: 4px;
  color: var(--muted);
  font-size: 10.5px;
  line-height: 1.75;
}

.edit-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: 62vh;
  overflow-y: auto;
  padding: 1px 2px 3px;
}

.edit-note {
  color: var(--muted-soft);
  font-size: 9px;
  line-height: 1.7;
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
  font-size: 8.5px;
  line-height: 1.5;
  text-align: left;
}

/* el-dialog 会传送到 body 外层，作用域属性到不了弹窗根节点。 */
:global(.consistency-dialog .el-dialog__body) {
  max-height: 66vh;
  overflow-y: auto;
  padding: 4px 24px 12px;
}

:global(.consistency-dialog .el-dialog__body)::-webkit-scrollbar {
  width: 5px;
}

:global(.consistency-dialog .el-dialog__body)::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(63, 58, 48, 0.16);
}

@keyframes breathe {
  0%,
  100% {
    opacity: 0.55;
    transform: scale(0.96);
  }
  50% {
    opacity: 1;
    transform: scale(1.02);
  }
}

@media (max-width: 1120px) {
  .novel-head {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .head-actions {
    justify-content: flex-start;
  }

  .story-facts {
    display: none;
  }

  .workspace-grid {
    grid-template-columns: 208px minmax(0, 1fr);
  }
}

@media (max-width: 900px) {
  .workspace-grid {
    grid-template-columns: 1fr;
  }

  .chapter-rail {
    position: static;
  }

  .rail-list {
    flex-direction: row;
    max-height: none;
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 9px;
  }

  .chapter-item {
    flex: 0 0 180px;
    grid-template-columns: auto minmax(0, 1fr);
  }

  .latest-chip {
    display: none;
  }

  .rail-memory {
    display: none;
  }

  .story-link {
    white-space: nowrap;
  }
}

@media (max-width: 720px) {
  .workspace-topline {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }

  .novel-title {
    font-size: 32px;
  }

  .head-actions {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    width: 100%;
  }

  .head-actions :deep(.el-button) {
    width: 100%;
    padding: 8px 6px;
    font-size: 10px;
  }

  .head-actions :deep(.el-button > span) {
    gap: 3px;
  }

  .story-band {
    display: flex;
    align-items: flex-start;
    flex-direction: column;
    gap: 9px;
  }

  .story-link {
    margin-left: 42px;
  }

  .reading-card,
  .composer {
    padding: 19px 17px 16px;
  }

  .reading-body {
    padding-left: 15px;
  }

  .reading-body :deep(.content-prose) {
    font-size: 14.5px;
    line-height: 1.95;
  }

  .reading-head h2 {
    font-size: 20px;
  }

  .saved-chip {
    display: none;
  }

  .history-card {
    align-items: flex-start;
    flex-direction: column;
    gap: 14px;
  }

  .composer-head {
    flex-direction: column;
    gap: 5px;
  }

  .composer-blocker {
    align-items: flex-start;
    flex-direction: column;
  }

  .composer-form {
    grid-template-columns: 1fr;
  }

  .span-2 {
    grid-column: span 1;
  }

  .strict-row {
    align-items: flex-start;
  }

  .composer-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .composer-actions :deep(.el-button) {
    width: 100%;
  }

  .candidate-head {
    flex-wrap: wrap;
  }

  .candidate-heading {
    flex: 1 1 calc(100% - 44px);
  }

  .candidate-badges {
    width: 100%;
    justify-content: flex-start;
    padding-left: 38px;
  }

  .candidate-summary {
    margin-left: 0;
  }

  .candidate-copy {
    padding-left: 0;
  }

  .candidate-fade {
    left: 0;
  }

  .candidate-expand {
    margin-left: 0;
  }

  .candidate-actions {
    align-items: stretch;
  }

  .candidate-actions :deep(.el-button) {
    flex: 0 0 auto;
  }

  .action-spacer {
    display: none;
  }

  .candidate-actions :deep(.el-button:nth-last-child(-n + 2)) {
    flex: 1;
  }

  .dialog-foot {
    align-items: stretch;
    flex-direction: column;
    gap: 10px;
  }

  .dialog-foot > div {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 6px;
  }
}

@media (max-width: 480px) {
  .head-actions {
    grid-template-columns: 1fr;
  }

  .reading-empty h2 {
    font-size: 21px;
  }

  .candidate-actions :deep(.el-button) {
    flex: 1 1 calc(50% - 4px);
  }

  .candidate-actions :deep(.el-button:nth-child(2)) {
    flex: 1 1 calc(50% - 4px);
  }
}
</style>
