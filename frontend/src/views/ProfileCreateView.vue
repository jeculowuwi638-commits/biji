<template>
  <div class="page-shell create-page">
    <template v-if="creating">
      <section class="extracting paper-card rise">
        <div class="extract-visual">
          <span class="seal extract-seal">迹</span>
          <div class="ink-orbit orbit-one" />
          <div class="ink-orbit orbit-two" />
        </div>
        <p class="eyebrow plain">Extracting your voice</p>
        <h1>正在提取你的笔迹</h1>
        <p class="extract-sub">
          正在分析 {{ validArticles.length }} 篇文章、{{ totalChars }} 个字。请不要关闭页面。
        </p>

        <div class="stage-list">
          <div
            v-for="(stage, index) in stages"
            :key="stage.title"
            class="stage"
            :class="{ active: index === stageIndex, done: index < stageIndex }"
          >
            <span class="stage-icon">
              <el-icon v-if="index < stageIndex"><Check /></el-icon>
              <el-icon v-else-if="index === stageIndex" class="spin"><Loading /></el-icon>
              <span v-else class="stage-no mono">{{ index + 1 }}</span>
            </span>
            <div>
              <strong>{{ stage.title }}</strong>
              <p>{{ stage.detail }}</p>
            </div>
          </div>
        </div>
        <p class="extract-hint">通常需要 10–30 秒。首次分析会调用一次语义模型。</p>
      </section>
    </template>

    <template v-else>
      <header class="create-header">
        <button type="button" class="back-link" @click="router.push({ name: 'profiles' })">
          <el-icon><ArrowLeft /></el-icon>
          返回档案
        </button>
        <p class="eyebrow">New archive · 提取笔迹</p>
        <h1 class="page-title">把写过的文章，<br />变成一份表达指纹。</h1>
        <p class="page-subtitle">
          建议提供 3–10 篇同一身份、同一场景下写过的文章。越接近你真实表达的文章，提取出的档案越像你。
        </p>
      </header>

      <div class="create-layout">
        <main class="create-main">
          <section class="form-card paper-card">
            <div class="form-section">
              <span class="section-kicker">01 · Name</span>
              <div class="section-row">
                <div>
                  <h2>给这份笔迹起个名字</h2>
                  <p>比如“工作汇报”“随笔生活”“观点评论”。不同场景可以建不同档案。</p>
                </div>
                <span class="name-count mono">{{ form.name.length }} / 30</span>
              </div>
              <el-input
                v-model="form.name"
                size="large"
                maxlength="30"
                placeholder="这份笔迹叫什么？"
                class="name-input"
              />
            </div>

            <div class="form-divider" />

            <div class="form-section">
              <span class="section-kicker">02 · Corpus</span>
              <div class="section-row">
                <div>
                  <h2>放入你的历史文章</h2>
                  <p>支持直接粘贴，或上传 .txt 文件。至少 3 篇，每篇不少于 20 个字符。</p>
                </div>
                <div class="corpus-actions">
                  <el-button size="small" @click="fillDemo" :loading="demoLoading">
                    <el-icon><MagicStick /></el-icon>
                    填入演示语料
                  </el-button>
                  <el-button size="small" @click="triggerUpload">
                    <el-icon><Upload /></el-icon>
                    上传 .txt
                  </el-button>
                  <input
                    ref="fileInput"
                    type="file"
                    accept=".txt,text/plain"
                    multiple
                    class="file-input"
                    @change="handleFiles"
                  />
                </div>
              </div>

              <div class="corpus-meter">
                <div class="meter-item">
                  <strong class="mono">{{ validArticles.length }}</strong>
                  <span>篇有效文章</span>
                </div>
                <div class="meter-item">
                  <strong class="mono">{{ totalChars }}</strong>
                  <span>总字数</span>
                </div>
                <div class="meter-item">
                  <strong class="mono">{{ articles.length }}</strong>
                  <span>输入框</span>
                </div>
                <div class="meter-status" :class="corpusReady ? 'ready' : 'pending'">
                  <el-icon>
                    <CircleCheck v-if="corpusReady" />
                    <Warning v-else />
                  </el-icon>
                  {{ corpusReady ? '语料数量已达标' : '至少需要 3 篇有效文章' }}
                </div>
              </div>

              <div class="article-list">
                <article
                  v-for="(article, index) in articles"
                  :key="index"
                  class="article-item"
                  :class="{ filled: article.trim().length >= 20 }"
                >
                  <header class="article-head">
                    <div class="article-title">
                      <span class="article-no mono">{{ String(index + 1).padStart(2, '0') }}</span>
                      <span>文章 {{ index + 1 }}</span>
                      <span
                        v-if="article.trim().length && article.trim().length < 20"
                        class="article-warning"
                      >
                        至少 20 字
                      </span>
                    </div>
                    <div class="article-tools">
                      <span class="article-count mono">{{ article.trim().length }} 字</span>
                      <el-tooltip
                        :content="articles.length <= 3 ? '至少保留 3 个输入框' : '移除这篇文章'"
                        placement="top"
                      >
                        <el-button
                          text
                          circle
                          size="small"
                          class="remove-btn"
                          :disabled="articles.length <= 3"
                          @click="removeArticle(index)"
                        >
                          <el-icon><Close /></el-icon>
                        </el-button>
                      </el-tooltip>
                    </div>
                  </header>
                  <el-input
                    v-model="articles[index]"
                    type="textarea"
                    :autosize="{ minRows: 6, maxRows: 14 }"
                    resize="vertical"
                    :placeholder="
                      index === 0
                        ? '粘贴第一篇历史文章……'
                        : '粘贴第 ' + (index + 1) + ' 篇文章……'
                    "
                  />
                </article>
              </div>

              <el-button
                class="add-article"
                :disabled="articles.length >= 10"
                @click="addArticle"
              >
                <el-icon><Plus /></el-icon>
                {{ articles.length >= 10 ? '最多 10 篇' : '再加一篇文章' }}
              </el-button>
            </div>

            <div class="form-divider" />

            <div class="form-footer">
              <div class="readonly-hint">
                <el-icon><Lock /></el-icon>
                <p>
                  生成后统计与语义结果不能手改；以后可以继续投喂文章来更新。这样每次检测都基于一份可追溯的语料基线。
                </p>
              </div>
              <el-button
                type="primary"
                size="large"
                class="submit-btn"
                :loading="false"
                @click="submit"
              >
                提取笔迹档案
                <el-icon><Right /></el-icon>
              </el-button>
            </div>

            <el-alert
              v-if="errorInfo"
              class="submit-error"
              :title="errorInfo.title"
              type="error"
              show-icon
              :closable="false"
            >
              <p class="error-text">{{ errorInfo.message }}</p>
            </el-alert>
          </section>
        </main>

        <aside class="create-aside">
          <section class="aside-card paper-card">
            <span class="section-kicker">What we read</span>
            <h3>我们会提取什么</h3>
            <div class="layer-list">
              <div class="layer">
                <span class="layer-no mono">01</span>
                <div>
                  <strong>统计层</strong>
                  <p>句长分布、短句比例、正式度、情绪浓度、比喻密度、高频词与标点习惯。</p>
                </div>
              </div>
              <div class="layer">
                <span class="layer-no mono">02</span>
                <div>
                  <strong>语义层</strong>
                  <p>开头方式、推进结构、收尾习惯、口头禅、举例方式和标志动作。</p>
                </div>
              </div>
              <div class="layer">
                <span class="layer-no mono">03</span>
                <div>
                  <strong>可追加档案</strong>
                  <p>两层结果合成结构化档案，生成和检测时直接调用。结果不能手改，但可以继续投喂文章更新。</p>
                </div>
              </div>
            </div>
          </section>

          <section class="aside-card paper-card tips-card">
            <span class="section-kicker">For a better profile</span>
            <h3>让档案更像你的三个建议</h3>
            <ul>
              <li>
                <el-icon><Check /></el-icon>
                <span><b>同一身份</b>：不要把工作汇报和生活随笔混在一起。</span>
              </li>
              <li>
                <el-icon><Check /></el-icon>
                <span><b>完整文章</b>：尽量给全文，不要只给金句或片段。</span>
              </li>
              <li>
                <el-icon><Check /></el-icon>
                <span><b>真实表达</b>：用你平时会写的样子，不必刻意润色。</span>
              </li>
            </ul>
          </section>

          <section class="aside-note">
            <el-icon><InfoFilled /></el-icon>
            <p>
              不训练模型，不做公开分享。为支持后续继续投喂，原文会保存在本机数据库中，仅用于档案分析；删除档案时会一并删除。
            </p>
          </section>
        </aside>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { metaApi, profileApi } from '../api';

const router = useRouter();
const route = useRoute();

const form = reactive({ name: '' });
const articles = ref(['', '', '']);
const fileInput = ref(null);
const demoLoading = ref(false);
const creating = ref(false);
const errorInfo = ref(null);
const stageIndex = ref(0);
let stageTimer = null;

const stages = [
  { title: '统计句式与用词', detail: '统计句长、短句比例、语气、标点和高频词。' },
  { title: '识别表达习惯', detail: '识别开头、推进、收尾、口头禅和标志动作。' },
  { title: '合成笔迹档案', detail: '把两层结果整理成结构化档案，准备进入写作。' },
];

const validArticles = computed(() =>
  articles.value.map((text) => text.trim()).filter((text) => text.length >= 20)
);
const totalChars = computed(() =>
  validArticles.value.reduce((sum, text) => sum + text.length, 0)
);
const corpusReady = computed(() => validArticles.value.length >= 3);

function addArticle() {
  if (articles.value.length >= 10) return;
  articles.value.push('');
}

function removeArticle(index) {
  if (articles.value.length <= 3) return;
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
    } else if (articles.value.length < 10) {
      articles.value.push(text);
      cursor = articles.value.length;
    } else {
      ElMessage.warning('最多 10 篇文章，部分文件未导入');
      break;
    }
  }
  ElMessage.success(`已导入 ${contents.length} 篇 .txt 文章`);
}

async function fillDemo() {
  if (demoLoading.value) return;
  demoLoading.value = true;
  errorInfo.value = null;
  try {
    const data = await metaApi.demo();
    const demoArticles = data.analysis?.articles || [];
    if (!demoArticles.length) throw new Error('演示语料不可用');

    form.name = data.analysis.suggestedName || '演示档案';
    articles.value = demoArticles.slice(0, 10);
    while (articles.value.length < 3) articles.value.push('');
    ElMessage.success('已填入演示语料');
  } catch (error) {
    ElMessage.error(error.message || '演示语料加载失败');
  } finally {
    demoLoading.value = false;
  }
}

function validate() {
  if (!form.name.trim()) {
    ElMessage.warning('请先给这份笔迹起一个名字');
    return false;
  }
  const tooShort = articles.value.some(
    (text) => text.trim().length > 0 && text.trim().length < 20
  );
  if (tooShort) {
    ElMessage.warning('有文章太短了，请补到至少 20 个字符，或清空该输入框');
    return false;
  }
  if (!corpusReady.value) {
    ElMessage.warning('至少需要 3 篇有效文章');
    return false;
  }
  if (validArticles.value.length > 10) {
    ElMessage.warning('最多提供 10 篇文章');
    return false;
  }
  if (totalChars.value > 60000) {
    ElMessage.warning('总字数不能超过 60000 个字符，请删减一些内容');
    return false;
  }
  return true;
}

async function submit() {
  if (creating.value) return;
  errorInfo.value = null;
  if (!validate()) return;

  creating.value = true;
  stageIndex.value = 0;
  stageTimer = window.setInterval(() => {
    if (stageIndex.value < stages.length - 1) stageIndex.value += 1;
  }, 4500);

  try {
    const data = await profileApi.create({
      name: form.name.trim(),
      texts: validArticles.value,
    });
    window.clearInterval(stageTimer);
    stageIndex.value = stages.length;
    ElMessage.success('笔迹档案已生成');
    router.replace({
      name: 'profile-detail',
      params: { id: data.profile.id },
      query: { created: '1' },
    });
  } catch (error) {
    window.clearInterval(stageTimer);
    creating.value = false;
    ElMessage.error(error.message || '档案提取失败，请稍后再试');
    if (error.message) {
      errorInfo.value = { code: error.code, title: '没有提取成功', message: error.message };
    }
  }
}

onMounted(() => {
  if (route.query.demo === '1') fillDemo();
});

onBeforeUnmount(() => {
  if (stageTimer) window.clearInterval(stageTimer);
});
</script>

<style scoped>
.create-page {
  max-width: 1220px;
}

.create-header {
  max-width: 760px;
  margin-bottom: 38px;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 28px;
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

.create-header .eyebrow {
  margin-top: 6px;
}

.create-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 26px;
  align-items: start;
}

.form-card {
  padding: 34px 34px 28px;
}

.section-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 22px;
}

.section-row h2 {
  margin-top: 5px;
  font-size: 21px;
  letter-spacing: -0.02em;
}

.section-row p {
  margin-top: 6px;
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.75;
}

.name-count,
.article-count {
  color: var(--muted-soft);
  font-size: 9.5px;
  white-space: nowrap;
}

.name-input {
  margin-top: 16px;
}

.form-divider {
  height: 1px;
  margin: 30px 0;
  background: var(--line);
}

.corpus-actions {
  display: flex;
  gap: 6px;
  flex: none;
}

.file-input {
  display: none;
}

.corpus-meter {
  display: flex;
  align-items: center;
  gap: 28px;
  margin-top: 18px;
  padding: 12px 16px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: rgba(255, 253, 248, 0.5);
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
  font-size: 9.5px;
}

.meter-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  font-size: 10px;
}

.meter-status.ready {
  color: var(--jade);
}

.meter-status.pending {
  color: var(--gold);
}

.article-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 18px;
}

.article-item {
  padding: 13px 15px 15px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: rgba(255, 253, 248, 0.38);
  transition: border-color 0.2s ease;
}

.article-item:focus-within {
  border-color: var(--line-strong);
}

.article-item.filled {
  border-color: rgba(69, 100, 82, 0.24);
}

.article-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.article-title {
  display: flex;
  align-items: center;
  gap: 8px;
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

.article-tools {
  display: flex;
  align-items: center;
  gap: 5px;
}

.remove-btn {
  color: var(--muted-soft);
}

.remove-btn:hover {
  color: var(--vermilion);
}

.add-article {
  width: 100%;
  margin-top: 14px;
  border-style: dashed;
}

.form-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.readonly-hint {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  max-width: 400px;
  color: var(--muted-soft);
}

.readonly-hint .el-icon {
  margin-top: 3px;
  flex: none;
  font-size: 13px;
}

.readonly-hint p {
  font-size: 10px;
  line-height: 1.7;
}

.submit-btn {
  flex: none;
  min-width: 190px;
}

.submit-error {
  margin-top: 22px;
}

.error-text {
  margin-top: 4px;
  font-size: 11.5px;
  line-height: 1.7;
}

.create-aside {
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: sticky;
  top: 28px;
}

.aside-card {
  padding: 22px 22px 20px;
}

.aside-card h3 {
  margin-top: 7px;
  font-size: 16px;
}

.layer-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 18px;
}

.layer {
  display: flex;
  gap: 10px;
}

.layer-no {
  flex: none;
  color: var(--vermilion);
  font-size: 9.5px;
  font-weight: 600;
}

.layer strong {
  display: block;
  font-family: var(--font-serif);
  font-size: 12.5px;
}

.layer p {
  margin-top: 4px;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.7;
}

.tips-card ul {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
}

.tips-card li {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  color: var(--muted);
  font-size: 10.5px;
  line-height: 1.7;
}

.tips-card li .el-icon {
  margin-top: 4px;
  flex: none;
  color: var(--jade);
  font-size: 10px;
}

.tips-card b {
  color: var(--ink-soft);
  font-weight: 600;
}

.aside-note {
  display: flex;
  gap: 8px;
  padding: 4px 4px 0;
  color: var(--muted-soft);
}

.aside-note .el-icon {
  margin-top: 3px;
  flex: none;
  font-size: 12px;
}

.aside-note p {
  font-size: 9.5px;
  line-height: 1.7;
}

.extracting {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 620px;
  margin: 8vh auto 0;
  padding: 54px 52px 46px;
  text-align: center;
  background:
    radial-gradient(circle at 50% 0%, rgba(185, 65, 43, 0.08), transparent 46%),
    rgba(255, 253, 248, 0.72);
}

.extract-visual {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 104px;
  height: 104px;
  margin-bottom: 26px;
}

.extract-seal {
  width: 52px;
  height: 52px;
  font-size: 27px;
}

.ink-orbit {
  position: absolute;
  inset: 0;
  border: 1px solid rgba(185, 65, 43, 0.18);
  border-radius: 50%;
  animation: orbit 3.2s linear infinite;
}

.orbit-two {
  inset: 12px;
  border-style: dashed;
  animation-direction: reverse;
  animation-duration: 5.5s;
}

@keyframes orbit {
  to {
    transform: rotate(360deg);
  }
}

.extracting h1 {
  margin-top: 12px;
  font-size: 31px;
  letter-spacing: -0.03em;
}

.extract-sub {
  margin-top: 10px;
  color: var(--muted);
  font-size: 12px;
}

.stage-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  width: 100%;
  margin-top: 32px;
  text-align: left;
}

.stage {
  display: flex;
  gap: 12px;
  padding: 13px 0;
  border-top: 1px solid var(--line);
  opacity: 0.42;
  transition: opacity 0.3s ease;
}

.stage.active,
.stage.done {
  opacity: 1;
}

.stage-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 22px;
  height: 22px;
  margin-top: 1px;
  border: 1px solid var(--line-strong);
  border-radius: 50%;
  color: var(--muted);
  font-size: 10px;
}

.stage.active .stage-icon {
  border-color: var(--vermilion);
  color: var(--vermilion);
}

.stage.done .stage-icon {
  border-color: var(--jade);
  background: var(--jade);
  color: #f7f1e5;
}

.stage-no {
  font-size: 9px;
}

.stage strong {
  display: block;
  font-family: var(--font-serif);
  font-size: 13px;
}

.stage p {
  margin-top: 3px;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.65;
}

.extract-hint {
  margin-top: 22px;
  color: var(--muted-soft);
  font-size: 9.5px;
}

@media (max-width: 980px) {
  .create-layout {
    grid-template-columns: 1fr;
  }

  .create-aside {
    position: static;
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .aside-note {
    grid-column: 1 / -1;
  }
}

@media (max-width: 680px) {
  .form-card {
    padding: 24px 18px 22px;
  }

  .section-row {
    flex-direction: column;
    gap: 10px;
  }

  .corpus-actions {
    flex-wrap: wrap;
  }

  .corpus-meter {
    flex-wrap: wrap;
    gap: 14px;
  }

  .meter-status {
    width: 100%;
    margin-left: 0;
  }

  .form-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .submit-btn {
    width: 100%;
  }

  .create-aside {
    grid-template-columns: 1fr;
  }

  .extracting {
    padding: 40px 24px 34px;
  }
}
</style>
