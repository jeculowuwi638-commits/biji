import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { layout: 'auth', public: true, title: '登录' },
  },
  {
    path: '/',
    redirect: '/profiles',
  },
  {
    path: '/profiles',
    name: 'profiles',
    component: () => import('../views/ProfileListView.vue'),
    meta: { title: '笔迹档案' },
  },
  {
    path: '/profiles/new',
    name: 'profile-create',
    component: () => import('../views/ProfileCreateView.vue'),
    meta: { title: '新建档案' },
  },
  {
    path: '/profiles/:id',
    name: 'profile-detail',
    component: () => import('../views/ProfileDetailView.vue'),
    meta: { title: '档案详情' },
  },
  {
    path: '/write',
    name: 'write',
    component: () => import('../views/WriteView.vue'),
    meta: { title: '写作台' },
  },
  {
    path: '/articles',
    name: 'articles',
    component: () => import('../views/ArticleListView.vue'),
    meta: { title: '我的文章' },
  },
  {
    path: '/articles/:id',
    name: 'article-detail',
    component: () => import('../views/ArticleDetailView.vue'),
    meta: { title: '文章详情' },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/profiles',
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (to.meta.public) {
    if (auth.token && to.name === 'login') {
      try {
        if (!auth.user) await auth.fetchMe();
        return { name: 'profiles' };
      } catch {
        auth.logout();
      }
    }
    return true;
  }

  if (!auth.token) {
    return {
      name: 'login',
      query: to.fullPath !== '/' ? { redirect: to.fullPath } : {},
    };
  }

  if (!auth.user) {
    try {
      await auth.fetchMe();
    } catch {
      auth.logout();
      return {
        name: 'login',
        query: { redirect: to.fullPath },
      };
    }
  }

  return true;
});

router.afterEach((to) => {
  document.title = to.meta?.title ? `${to.meta.title} · 笔迹` : '笔迹 · 你的个人 AI 写作分身';
});

export default router;
