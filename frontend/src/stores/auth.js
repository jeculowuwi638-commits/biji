import { defineStore } from 'pinia';
import { authApi, TOKEN_STORAGE_KEY } from '../api';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem(TOKEN_STORAGE_KEY) || '',
    user: null,
    loading: false,
  }),

  getters: {
    isLoggedIn: (state) => Boolean(state.token),
    displayName: (state) => state.user?.username || '写作者',
  },

  actions: {
    setSession(payload) {
      this.token = payload.token;
      this.user = payload.user;
      localStorage.setItem(TOKEN_STORAGE_KEY, payload.token);
      localStorage.setItem('biji_user', JSON.stringify(payload.user));
    },

    async login(credentials) {
      this.loading = true;
      try {
        const data = await authApi.login(credentials);
        this.setSession(data);
        return data.user;
      } finally {
        this.loading = false;
      }
    },

    async register(credentials) {
      this.loading = true;
      try {
        const data = await authApi.register(credentials);
        this.setSession(data);
        return data.user;
      } finally {
        this.loading = false;
      }
    },

    async fetchMe() {
      if (!this.token) return null;
      const data = await authApi.me();
      this.user = data.user;
      localStorage.setItem('biji_user', JSON.stringify(data.user));
      return data.user;
    },

    logout() {
      this.token = '';
      this.user = null;
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem('biji_user');
    },
  },
});
