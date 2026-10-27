import { api } from './api.js';

export const FilesModel = {
  list: (filters = {}) => api.get('/files', { query: { page: 1, limit: 24, ...filters } }),
  mine: () => api.get('/files/mine'),
  upload: (formData, onProgress) => api.upload('/files', formData, onProgress),
  duplicates: ({ hash, fileName, title }) => api.get('/files/duplicates', { query: { hash, fileName, title } }),
  remove: (id) => api.delete(`/files/${id}`),
  rating: (id) => api.get(`/files/${id}/rating`),
  rate: (id, rating) => api.patch(`/files/${id}/rating`, { rating }),
};

export const TaxonomyModel = {
  locations: () => api.get('/locations'),
  institutions: (locationId = '') => api.get('/institutions', { query: { locationId } }),
  careers: () => api.get('/careers'),
  years: (level) => api.get('/years', { query: { level } }),
  subjects: () => api.get('/subjects'),
  pickupPoints: () => api.get('/pickup-points'),
  discountTiers: () => api.get('/discount-tiers'),

  // Altas hechas por el usuario cuando no encuentra la opción (type: institution | career | subject).
  similar: (type, name, locationId = '') => api.get('/taxonomy/similar', { query: { type, name, locationId } }),
  create: (type, payload) => api.post(`/${{ institution: 'institutions', career: 'careers', subject: 'subjects' }[type]}`, payload),
};

export const OrdersModel = {
  create: (payload) => api.post('/orders', payload),
  mine: () => api.get('/orders/mine'),
  detail: (id) => api.get(`/orders/${id}`),
  pending: (id, preferenceId) => api.get(`/orders/pending/${id}`, { query: { preference_id: preferenceId } }),
  listAll: (status = '') => api.get('/orders/admin', { query: { status } }),
  updateStatus: (id, status) => api.patch(`/orders/${id}/status`, { status }),
};

export const SettingsModel = {
  get: () => api.get('/settings'),
};

export const ContactModel = {
  info: () => api.get('/contact'),
  send: (payload) => api.post('/contact', payload),
};
