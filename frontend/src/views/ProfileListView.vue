<template>
  <div class="page-shell">
    <header class="page-header">
      <div>
        <p class="eyebrow">Archive · 笔迹档案</p>
        <h1 class="page-title">你的表达，<br />有迹可循。</h1>
        <p class="page-subtitle">
          每一份档案都是从你的历史文章里提取出的表达指纹。结果不能手动改写，但可以继续投喂新文章来更新。
        </p>
      </div>
      <div class="header-actions">
        <el-button size="large" @click="createWithDemo">用演示语料试一份</el-button>
        <el-button type="primary" size="large" @click="router.push({ name: 'profile-create' })">
          <el-icon><Plus /></el-icon>
          新建档案
        </el-button>
      </div>
    </header>

    <section v-if="loading" class="profile-grid">
      <div v-for="item in 3" :key="item" class="skeleton-card paper-card">
        <el-skeleton :rows="4" animated />
      </div>
    </section>

    <template v-else-if="profiles.length">
      <div class="archive-bar">
        <div class="archive-stats">
          <div class="archive-stat">
            <strong class="mono">{{ profiles.length }}</strong>
            <span>份档案</span>
          </div>
          <div class="archive-stat">
            <strong class="mono">{{ totalArticles }}</strong>
            <span>篇历史文章</span>
          </div>
          <div class="archive-stat">
            <strong class="mono">{{ totalChars.toLocaleString('zh-CN') }}</strong>
            <span>字语料</span>
          </div>
        </div>
        <span class="readonly-note">
          <el-icon><Upload /></el-icon>
          可追加 · 可改名 / 可删除 / 可新建
        </span>
      </div>

      <div class="profile-grid">
        <ProfileCard
          v-for="(profile, index) in profiles"
          :key="profile.id"
          :profile="profile"
          :index="index"
          @delete="handleDelete"
          @use="useProfile"
        />
      </div>
    </template>

    <section v-else class="empty-state paper-card">
      <span class="empty-seal seal">迹</span>
      <p class="eyebrow plain">No archive yet</p>
      <h2>还没有属于你的笔迹</h2>
      <p>
        粘贴 3–10 篇你写过的文章，笔迹会提取你的句长、语气、口头禅和结构习惯，
        生成一份可以继续投喂更新的表达档案。
      </p>
      <div class="empty-actions">
        <el-button type="primary" size="large" @click="router.push({ name: 'profile-create' })">
          提取第一份档案
        </el-button>
        <el-button size="large" @click="createWithDemo">先看看演示语料</el-button>
      </div>
      <div class="empty-hints">
        <span>不需要邮箱</span>
        <i />
        <span>不上传云端训练</span>
        <i />
        <span>随时可以删除</span>
      </div>
    </section>

    <section class="how-card">
      <div class="how-copy">
        <span class="section-kicker">How it works</span>
        <h2>一份档案，三层提取</h2>
        <p>
          先做统计层（句长、用词、标点、口头禅），再做语义层（开头、推进、收尾和标志动作），
          最后把两层合成一份结构化档案。结果不允许手改；有新文章时可以继续投喂更新。
        </p>
      </div>
      <div class="how-steps">
        <div class="how-step">
          <span class="mono">01</span>
          <strong>统计层</strong>
          <p>句长分布、短句比例、正式度、情绪浓度、比喻密度与高频词。</p>
        </div>
        <div class="how-step">
          <span class="mono">02</span>
          <strong>语义层</strong>
          <p>开头方式、推进结构、收尾习惯、口头禅、举例方式和标志动作。</p>
        </div>
        <div class="how-step">
          <span class="mono">03</span>
          <strong>可追加档案</strong>
          <p>结果不能手改；有新文章时继续投喂，系统会合并新旧语料后重新提取。</p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import ProfileCard from '../components/ProfileCard.vue';
import { profileApi } from '../api';

const router = useRouter();
const profiles = ref([]);
const loading = ref(true);

const totalArticles = computed(() =>
  profiles.value.reduce((sum, profile) => sum + (Number(profile.stats?.articleCount) || 0), 0)
);
const totalChars = computed(() =>
  profiles.value.reduce((sum, profile) => sum + (Number(profile.stats?.charCount) || 0), 0)
);

async function load() {
  loading.value = true;
  try {
    const data = await profileApi.list();
    profiles.value = data.profiles || [];
  } catch (error) {
    ElMessage.error(error.message || '档案加载失败');
  } finally {
    loading.value = false;
  }
}

function createWithDemo() {
  router.push({ name: 'profile-create', query: { demo: '1' } });
}

function useProfile(profile) {
  router.push({ name: 'write', query: { profile: profile.id } });
}

async function handleDelete(profile) {
  try {
    await ElMessageBox.confirm(
      `删除「${profile.name}」后，这份档案无法恢复。用它生成过的文章会保留，但不再关联档案。`,
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
    await profileApi.remove(profile.id);
    profiles.value = profiles.value.filter((item) => item.id !== profile.id);
    ElMessage.success('档案已删除');
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
  font-size: 10px;
}

.profile-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.skeleton-card {
  min-height: 310px;
  padding: 26px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 68px 30px 58px;
  text-align: center;
  background:
    radial-gradient(circle at 50% 0%, rgba(185, 65, 43, 0.07), transparent 42%),
    rgba(255, 253, 248, 0.66);
}

.empty-seal {
  width: 54px;
  height: 54px;
  margin-bottom: 24px;
  font-size: 28px;
  opacity: 0.86;
}

.empty-state h2 {
  margin-top: 12px;
  font-size: 30px;
  letter-spacing: -0.03em;
}

.empty-state > p:not(.eyebrow) {
  max-width: 440px;
  margin-top: 12px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.9;
}

.empty-actions {
  display: flex;
  gap: 10px;
  margin-top: 26px;
}

.empty-hints {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 30px;
  color: var(--muted-soft);
  font-size: 9.5px;
}

.empty-hints i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--line-strong);
}

.how-card {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  gap: 44px;
  margin-top: 54px;
  padding: 34px 36px;
  border-top: 1px solid var(--line-strong);
  border-bottom: 1px solid var(--line);
}

.how-copy h2 {
  margin-top: 8px;
  font-size: 24px;
  letter-spacing: -0.025em;
}

.how-copy p {
  margin-top: 12px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.9;
}

.how-steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 22px;
}

.how-step span {
  color: var(--vermilion);
  font-size: 10px;
  font-weight: 600;
}

.how-step strong {
  display: block;
  margin-top: 8px;
  font-family: var(--font-serif);
  font-size: 14px;
}

.how-step p {
  margin-top: 6px;
  color: var(--muted);
  font-size: 10.5px;
  line-height: 1.75;
}

@media (max-width: 980px) {
  .profile-grid {
    grid-template-columns: 1fr;
  }

  .how-card {
    grid-template-columns: 1fr;
    gap: 28px;
  }

  .header-actions {
    flex-wrap: wrap;
  }
}

@media (max-width: 720px) {
  .archive-bar {
    flex-direction: column;
    align-items: flex-start;
  }

  .archive-stats {
    width: 100%;
    justify-content: space-between;
    gap: 10px;
  }

  .how-steps {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .header-actions {
    width: 100%;
  }

  .header-actions .el-button {
    flex: 1;
    margin-left: 0;
  }

  .empty-actions {
    flex-direction: column;
    width: 100%;
  }

  .empty-actions .el-button {
    margin-left: 0;
  }
}
</style>
