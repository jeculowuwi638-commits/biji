<template>
  <div class="login-page">
    <section class="login-hero">
      <div class="hero-top">
        <div class="brand-line">
          <span class="seal">笔</span>
          <div>
            <span class="brand-word hero-brand">笔迹</span>
            <span class="brand-sub hero-brand-sub">YOUR PERSONAL WRITING TWIN</span>
          </div>
        </div>
      </div>

      <div class="hero-copy">
        <p class="eyebrow hero-eyebrow">AI · PERSONAL VOICE</p>
        <h1>
          AI 替你写，<br />
          不如 AI <em>替你表达</em>。
        </h1>
        <p class="hero-lede">
          把历史文章交给笔迹，提取一份可继续投喂的“笔迹档案”。<br />
          从此每次生成，都按你的句式、语气和习惯来。
        </p>
      </div>

      <div class="hero-steps">
        <div class="hero-step">
          <span class="step-no">01</span>
          <div>
            <strong>提取档案</strong>
            <p>从 3–10 篇文章里，提取结构化表达特征。</p>
          </div>
        </div>
        <div class="hero-step">
          <span class="step-no">02</span>
          <div>
            <strong>三要素生成</strong>
            <p>写什么 · 用哪份笔迹 · 要不要微调。</p>
          </div>
        </div>
        <div class="hero-step">
          <span class="step-no">03</span>
          <div>
            <strong>像不像你</strong>
            <p>逐句指出哪里不像你，再一键改写。</p>
          </div>
        </div>
      </div>

      <p class="hero-quote">以前 AI 是“替你写”，笔迹想做的是“AI 替你表达”。</p>
      <span class="giant-mark">迹</span>
    </section>

    <section class="login-panel">
      <div class="form-wrap rise">
        <div class="mobile-brand">
          <span class="seal">笔</span>
          <span class="brand-word">笔迹</span>
        </div>

        <p class="eyebrow plain">{{ mode === 'login' ? 'Welcome back' : 'Begin here' }}</p>
        <h2 class="form-title">
          {{ mode === 'login' ? '回到你的笔迹' : '建立你的第一份笔迹' }}
        </h2>
        <p class="form-sub">
          {{
            mode === 'login'
              ? '登录后继续使用你的档案与生成记录。'
              : '只需要一个用户名和密码，不需要邮箱。'
          }}
        </p>

        <div class="auth-tabs">
          <button
            type="button"
            :class="{ active: mode === 'login' }"
            @click="switchMode('login')"
          >
            登录
          </button>
          <button
            type="button"
            :class="{ active: mode === 'register' }"
            @click="switchMode('register')"
          >
            注册
          </button>
          <span class="tab-line" :class="mode === 'register' ? 'right' : 'left'" />
        </div>

        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          label-position="top"
          class="auth-form"
          @submit.prevent="submit"
        >
          <el-form-item label="用户名" prop="username">
            <el-input
              v-model="form.username"
              size="large"
              maxlength="20"
              autocomplete="username"
              placeholder="3–20 个字符，支持中文"
              :prefix-icon="User"
            />
          </el-form-item>

          <el-form-item label="密码" prop="password">
            <el-input
              v-model="form.password"
              size="large"
              type="password"
              show-password
              maxlength="72"
              autocomplete="current-password"
              placeholder="至少 6 个字符"
              :prefix-icon="Lock"
              @keyup.enter="submit"
            />
          </el-form-item>

          <el-form-item v-if="mode === 'register'" label="确认密码" prop="confirm">
            <el-input
              v-model="form.confirm"
              size="large"
              type="password"
              show-password
              maxlength="72"
              autocomplete="new-password"
              placeholder="再输入一次密码"
              :prefix-icon="Lock"
              @keyup.enter="submit"
            />
          </el-form-item>

          <el-button
            class="submit-btn"
            type="primary"
            size="large"
            native-type="submit"
            :loading="auth.loading"
          >
            {{ mode === 'login' ? '进入笔迹' : '创建账号并进入' }}
            <el-icon v-if="!auth.loading" class="submit-icon"><Right /></el-icon>
          </el-button>
        </el-form>

        <div class="demo-box">
          <div class="demo-copy">
            <span class="demo-label">DEMO</span>
            <p>演示账号 <b>demo</b> / <b>demo1234</b>，含 2 份预置档案。</p>
          </div>
          <el-button text type="primary" @click="useDemo">直接登录</el-button>
        </div>

        <p class="form-foot">
          仅使用用户名 + 密码 + JWT。不收集邮箱、手机号，也不需要第三方登录。
        </p>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Lock, Right, User } from '@element-plus/icons-vue';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const mode = ref('login');
const formRef = ref(null);
const form = reactive({
  username: '',
  password: '',
  confirm: '',
});

const rules = computed(() => ({
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名需要 3–20 个字符', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 72, message: '密码需要 6–72 个字符', trigger: 'blur' },
  ],
  confirm:
    mode.value === 'register'
      ? [
          { required: true, message: '请再输入一次密码', trigger: 'blur' },
          {
            validator: (rule, value, callback) => {
              if (value !== form.password) callback(new Error('两次输入的密码不一致'));
              else callback();
            },
            trigger: 'blur',
          },
        ]
      : [],
}));

function switchMode(next) {
  if (mode.value === next) return;
  mode.value = next;
  form.confirm = '';
  formRef.value?.clearValidate();
}

function useDemo() {
  mode.value = 'login';
  form.username = 'demo';
  form.password = 'demo1234';
  form.confirm = '';
  formRef.value?.clearValidate();
  submit();
}

async function submit() {
  if (auth.loading) return;
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }

  try {
    if (mode.value === 'login') {
      await auth.login({ username: form.username.trim(), password: form.password });
      ElMessage.success('欢迎回来');
    } else {
      await auth.register({ username: form.username.trim(), password: form.password });
      ElMessage.success('账号已创建');
    }
    const redirect =
      typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
        ? route.query.redirect
        : '/profiles';
    router.replace(redirect);
  } catch (error) {
    ElMessage.error(error.message || '操作失败，请稍后再试');
  }
}

onMounted(() => {
  if (route.query.expired) {
    ElMessage.warning('登录状态已失效，请重新登录');
  }
});
</script>

<style scoped>
.login-page {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(430px, 0.85fr);
  min-height: 100vh;
  background: var(--paper);
}

.login-hero {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 48px 64px 44px;
  overflow: hidden;
  background:
    radial-gradient(circle at 18% 12%, rgba(185, 65, 43, 0.22), transparent 34%),
    linear-gradient(150deg, #26231d 0%, #1c1b18 46%, #151411 100%);
  color: #f7f1e5;
}

.login-hero::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.35;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.08'/%3E%3C/svg%3E");
}

.hero-top,
.hero-copy,
.hero-steps,
.hero-quote {
  position: relative;
  z-index: 1;
}

.hero-top {
  display: flex;
  justify-content: space-between;
}

.hero-brand {
  color: #f7f1e5;
}

.hero-brand-sub {
  color: rgba(247, 241, 229, 0.45);
}

.hero-copy {
  max-width: 660px;
  margin-top: auto;
  padding-top: 80px;
}

.hero-eyebrow {
  color: rgba(247, 241, 229, 0.48);
}

.hero-copy h1 {
  margin-top: 26px;
  font-family: var(--font-serif);
  font-size: clamp(46px, 5.4vw, 76px);
  font-weight: 500;
  letter-spacing: -0.048em;
  line-height: 1.18;
}

.hero-copy h1 em {
  position: relative;
  color: #e3aa94;
  font-style: normal;
}

.hero-copy h1 em::after {
  content: "";
  position: absolute;
  left: 2%;
  right: 0;
  bottom: 2px;
  height: 1px;
  background: rgba(227, 170, 148, 0.55);
}

.hero-lede {
  margin-top: 30px;
  color: rgba(247, 241, 229, 0.6);
  font-size: 14px;
  line-height: 2;
}

.hero-steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 22px;
  max-width: 760px;
  margin-top: auto;
  padding-top: 64px;
}

.hero-step {
  display: flex;
  gap: 12px;
  padding-top: 14px;
  border-top: 1px solid rgba(247, 241, 229, 0.14);
}

.step-no {
  color: #c98a72;
  font-family: var(--font-serif);
  font-size: 12px;
  letter-spacing: 0.08em;
}

.hero-step strong {
  display: block;
  margin-bottom: 5px;
  color: rgba(247, 241, 229, 0.92);
  font-family: var(--font-serif);
  font-size: 14px;
  font-weight: 600;
}

.hero-step p {
  color: rgba(247, 241, 229, 0.42);
  font-size: 11px;
  line-height: 1.7;
}

.hero-quote {
  max-width: 560px;
  margin-top: 30px;
  color: rgba(247, 241, 229, 0.34);
  font-family: var(--font-serif);
  font-size: 12px;
  letter-spacing: 0.02em;
}

.giant-mark {
  position: absolute;
  z-index: 0;
  right: -36px;
  bottom: 8%;
  color: transparent;
  font-family: var(--font-serif);
  font-size: clamp(280px, 40vw, 580px);
  line-height: 0.8;
  opacity: 0.055;
  -webkit-text-stroke: 1px #f7f1e5;
  user-select: none;
}

.login-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 48px 42px;
}

.form-wrap {
  width: 100%;
  max-width: 390px;
}

.mobile-brand {
  display: none;
}

.form-title {
  margin-top: 14px;
  font-size: 34px;
  letter-spacing: -0.04em;
  line-height: 1.25;
}

.form-sub {
  margin-top: 10px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.75;
}

.auth-tabs {
  position: relative;
  display: flex;
  gap: 28px;
  margin-top: 34px;
  border-bottom: 1px solid var(--line);
}

.auth-tabs button {
  position: relative;
  padding: 0 0 12px;
  border: 0;
  background: none;
  color: var(--muted);
  cursor: pointer;
  font-family: var(--font-serif);
  font-size: 15px;
  transition: color 0.2s ease;
}

.auth-tabs button.active {
  color: var(--ink);
}

.tab-line {
  position: absolute;
  bottom: -1px;
  width: 30px;
  height: 2px;
  background: var(--vermilion);
  transition: transform 0.25s cubic-bezier(0.22, 0.8, 0.3, 1);
}

.tab-line.left {
  transform: translateX(15px);
}

.tab-line.right {
  transform: translateX(15px + 28px + 30px);
}

.auth-form {
  margin-top: 26px;
}

.auth-form :deep(.el-form-item) {
  margin-bottom: 19px;
}

.auth-form :deep(.el-form-item__label) {
  padding-bottom: 6px;
  font-size: 12px;
}

.submit-btn {
  width: 100%;
  height: 46px;
  margin-top: 6px;
  letter-spacing: 0.04em;
}

.submit-icon {
  margin-left: 5px;
}

.demo-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-top: 26px;
  padding: 13px 15px;
  border: 1px dashed var(--line-strong);
  border-radius: 6px;
  background: rgba(255, 253, 248, 0.46);
}

.demo-copy {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.demo-label {
  flex: none;
  padding: 2px 6px;
  border-radius: 3px;
  background: var(--vermilion-soft);
  color: var(--vermilion);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.demo-copy p {
  color: var(--muted);
  font-size: 11px;
  line-height: 1.5;
}

.demo-copy b {
  color: var(--ink-soft);
  font-weight: 600;
}

.form-foot {
  margin-top: 24px;
  color: var(--muted-soft);
  font-size: 10px;
  line-height: 1.7;
}

@media (max-width: 1080px) {
  .login-page {
    grid-template-columns: minmax(0, 1fr) minmax(400px, 0.9fr);
  }

  .login-hero {
    padding: 40px 42px;
  }

  .hero-steps {
    grid-template-columns: 1fr;
    gap: 12px;
    padding-top: 40px;
  }

  .hero-step p {
    display: none;
  }
}

@media (max-width: 820px) {
  .login-page {
    display: block;
  }

  .login-hero {
    display: none;
  }

  .login-panel {
    min-height: 100vh;
    padding: 40px 24px;
    background:
      radial-gradient(circle at 80% 0%, rgba(185, 65, 43, 0.08), transparent 32%),
      var(--paper);
  }

  .mobile-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 54px;
  }
}
</style>
