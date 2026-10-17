import axios from 'axios';

const TOKEN_KEY = 'biji_token';

const api = axios.create({
  baseURL: '/api',
  timeout: 200000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let redirecting = false;

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data || {};
    const url = String(error.config?.url || '');

    if (
      status === 401 &&
      !url.includes('/auth/login') &&
      !url.includes('/auth/register') &&
      !redirecting
    ) {
      redirecting = true;
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('biji_user');
      if (window.location.pathname !== '/login') {
        window.location.assign('/login?expired=1');
      }
      window.setTimeout(() => {
        redirecting = false;
      }, 1500);
    }

    const message =
      data.message ||
      (status === 0 ? '网络连接失败，请检查后端是否已启动' : '') ||
      error.message ||
      '请求失败，请稍后再试';

    const normalized = new Error(message);
    normalized.status = status;
    normalized.code = data.error;
    normalized.details = data.details;
    throw normalized;
  }
);

export const TOKEN_STORAGE_KEY = TOKEN_KEY;

export const authApi = {
  login(payload) {
    return api.post('/auth/login', payload);
  },
  register(payload) {
    return api.post('/auth/register', payload);
  },
  me() {
    return api.get('/auth/me');
  },
};

export const profileApi = {
  list() {
    return api.get('/profiles');
  },
  create(payload) {
    return api.post('/profiles', payload);
  },
  detail(id) {
    return api.get(`/profiles/${id}`);
  },
  articles(id) {
    return api.get(`/profiles/${id}/articles`);
  },
  append(id, texts) {
    return api.post(`/profiles/${id}/append`, { texts });
  },
  rename(id, name) {
    return api.patch(`/profiles/${id}`, { name });
  },
  remove(id) {
    return api.delete(`/profiles/${id}`);
  },
};

export const writingApi = {
  generate(payload) {
    return api.post('/generate', payload);
  },
  score(payload) {
    return api.post('/score', payload);
  },
  rewrite(payload) {
    return api.post('/rewrite', payload);
  },
};

export const metaApi = {
  platforms() {
    return api.get('/meta');
  },
  demo() {
    return api.get('/demo');
  },
  health() {
    return api.get('/health');
  },
};

export default api;
