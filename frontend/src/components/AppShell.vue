<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="sidebar-brand" @click="router.push('/profiles')">
        <span class="seal">笔</span>
        <div class="brand-text">
          <span class="brand-word">笔迹</span>
          <span class="brand-sub">YOUR WRITING TWIN</span>
        </div>
      </div>

      <div class="sidebar-rule" />
      <div class="sidebar-label">Workspace</div>

      <nav class="sidebar-nav">
        <router-link
          to="/profiles"
          class="nav-item"
          :class="{ active: isProfileActive }"
        >
          <el-icon><Collection /></el-icon>
          <span>笔迹档案</span>
        </router-link>
        <router-link
          to="/write"
          class="nav-item"
          :class="{ active: route.name === 'write' }"
        >
          <el-icon><EditPen /></el-icon>
          <span>写作台</span>
        </router-link>
        <router-link
          to="/articles"
          class="nav-item"
          :class="{ active: route.path.startsWith('/articles') }"
        >
          <el-icon><Document /></el-icon>
          <span>我的文章</span>
        </router-link>
      </nav>

      <div class="sidebar-assistant">
        <AssistantPanel
          v-model="assistantDraft"
          compact
          :messages="assistantMessages"
          :loading="assistantLoading"
          @send="sendAssistant"
          @clear="clearAssistant"
        />
      </div>

      <div class="sidebar-foot">
        <el-dropdown trigger="click" placement="top-start" @command="handleCommand">
          <div class="user-chip">
            <div class="user-avatar">{{ initial }}</div>
            <div class="user-meta">
              <span class="user-name">{{ auth.displayName }}</span>
              <span class="user-role">PERSONAL SPACE</span>
            </div>
            <el-icon><MoreFilled /></el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </aside>

    <button
      type="button"
      class="assistant-fab"
      aria-label="打开写作助手"
      @click="assistantDrawer = true"
    >
      <el-icon><ChatDotRound /></el-icon>
      <span>写作助手</span>
    </button>

    <el-drawer
      v-model="assistantDrawer"
      direction="rtl"
      size="min(420px, 92vw)"
      class="assistant-drawer"
    >
      <template #header>
        <div class="drawer-head">
          <span class="drawer-title">写作助手</span>
          <el-button
            text
            size="small"
            :disabled="!assistantMessages.length || assistantLoading"
            @click="clearAssistant"
          >
            <el-icon><Delete /></el-icon>
            清空
          </el-button>
        </div>
      </template>
      <AssistantPanel
        hide-header
        v-model="assistantDraft"
        :messages="assistantMessages"
        :loading="assistantLoading"
        @send="sendAssistant"
        @clear="clearAssistant"
      />
    </el-drawer>

    <main class="main-area">
      <slot />
    </main>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import AssistantPanel from './AssistantPanel.vue';
import { assistantApi } from '../api';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const isProfileActive = computed(() => route.path.startsWith('/profiles'));
const initial = computed(() => (auth.user?.username || '笔').slice(0, 1).toUpperCase());

const assistantMessages = ref([]);
const assistantDraft = ref('');
const assistantLoading = ref(false);
const assistantDrawer = ref(false);

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

async function handleCommand(command) {
  if (command !== 'logout') return;
  try {
    await ElMessageBox.confirm('退出当前账号？未保存的输入会丢失。', '退出登录', {
      confirmButtonText: '退出',
      cancelButtonText: '留下',
      type: 'warning',
    });
  } catch {
    return;
  }
  auth.logout();
  router.replace({ name: 'login' });
}
</script>

<style scoped>
.sidebar-assistant {
  display: flex;
  height: clamp(260px, 40vh, 400px);
  min-height: 0;
  margin-top: auto;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}

.sidebar-assistant :deep(.assistant-panel) {
  flex: 1;
  min-height: 0;
}

.sidebar-foot {
  margin-top: 14px;
}

.assistant-fab {
  position: fixed;
  right: 22px;
  bottom: 22px;
  z-index: 25;
  display: none;
  align-items: center;
  gap: 7px;
  padding: 11px 16px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--paper-bright);
  box-shadow: var(--shadow-md);
  color: var(--ink-soft);
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease;
}

.assistant-fab:hover {
  border-color: var(--line-strong);
  color: var(--ink);
}

.assistant-fab .el-icon {
  color: var(--vermilion);
  font-size: 16px;
}

.assistant-drawer {
  background: var(--paper-soft);
}

.assistant-drawer :deep(.el-drawer__header) {
  margin-bottom: 0;
  padding: 20px 20px 14px;
  color: var(--ink);
  font-family: var(--font-serif);
  font-weight: 600;
}

.assistant-drawer :deep(.el-drawer__body) {
  padding: 0 18px 18px;
  overflow-y: auto;
}

.drawer-head {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  gap: 12px;
}

.drawer-title {
  font-family: var(--font-serif);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.drawer-head .el-button {
  margin-left: auto;
}

@media (max-width: 1080px) {
  .sidebar-assistant {
    display: none;
  }

  .assistant-fab {
    display: inline-flex;
  }
}

@media (max-width: 720px) {
  .assistant-fab {
    right: 16px;
    bottom: 76px;
  }
}
</style>
