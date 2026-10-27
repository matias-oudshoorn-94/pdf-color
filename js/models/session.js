import { api } from './api.js';

/** Estado de sesión observable (modelo compartido por las vistas). */
const listeners = new Set();
let loadPromise = null;

export const session = {
  user: null,
  ready: false,

  get isAuth() {
    return this.user != null;
  },

  get isAdmin() {
    return this.user?.role === 'admin';
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  emit() {
    for (const fn of listeners) fn(this.user);
  },

  set(user) {
    this.user = user;
    this.ready = true;
    this.emit();
  },

  // Memoizado: si el arranque de la app y una ruta protegida lo piden a la vez,
  // comparten el mismo pedido en vez de duplicar la llamada a /auth/me.
  load() {
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
      try {
        const { user } = await api.get('/auth/me');
        this.set(user);
      } catch {
        this.set(null);
      }
      return this.user;
    })();

    return loadPromise;
  },

  async login(credentials) {
    const { user } = await api.post('/auth/login', credentials);
    this.set(user);
    return user;
  },

  async loginWithGoogle(credential) {
    const { user } = await api.post('/auth/google', { credential });
    this.set(user);
    return user;
  },

  async register(data) {
    const { user } = await api.post('/auth/register', data);
    this.set(user);
    return user;
  },

  async logout() {
    await api.post('/auth/logout');
    this.set(null);
  },

  forgotPassword(email, recaptchaToken) {
    return api.post('/auth/forgot-password', { email, recaptchaToken });
  },

  async resetPassword(token, password, recaptchaToken) {
    const { user } = await api.post('/auth/reset-password', { token, password, recaptchaToken });
    this.set(user);
    return user;
  },

  updateProfile(data) {
    return api.patch('/auth/profile', data);
  },
};
