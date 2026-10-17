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
          <span>开始写作</span>
        </router-link>
      </nav>

      <div class="sidebar-foot">
        <div class="sidebar-note">
          <strong>档案是提取物</strong>
          <span>结果不可手改，但可以继续投喂文章来更新。</span>
        </div>

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

    <main class="main-area">
      <slot />
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessageBox } from 'element-plus';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const isProfileActive = computed(() => route.path.startsWith('/profiles'));
const initial = computed(() => (auth.user?.username || '笔').slice(0, 1).toUpperCase());

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
