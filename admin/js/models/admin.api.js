import { api } from '/js/models/api.js';

/** Acceso a los endpoints del panel. Los listados aceptan {search, page, perPage, sort, dir, ...}. */
export const AdminApi = {
  stats: () => api.get('/admin/stats'),
  copiesSold: () => api.get('/admin/copies-sold'),

  reportsSales: (params) => api.get('/admin/reports/sales', { query: params }),
  reportsOverview: (params) => api.get('/admin/reports/overview', { query: params }),
  reportsRankings: (params) => api.get('/admin/reports/rankings', { query: params }),

  settings: () => api.get('/settings'),
  updateSettings: (payload) => api.patch('/admin/settings', payload),

  orders: (params) => api.get('/admin/orders', { query: params }),
  order: (id) => api.get(`/admin/orders/${id}`),
  updateOrderStatus: (id, status) => api.patch(`/admin/orders/${id}/status`, { status }),
  updateOrderPaymentStatus: (id, paymentStatus) => api.patch(`/admin/orders/${id}/payment-status`, { paymentStatus }),
  notifyOrderReady: (id) => api.post(`/admin/orders/${id}/notify-ready`, {}),
  deleteOrder: (id) => api.delete(`/admin/orders/${id}`),

  files: (params) => api.get('/admin/files', { query: params }),
  updateFile: (id, payload) => api.patch(`/admin/files/${id}`, payload),
  deleteFile: (id) => api.delete(`/admin/files/${id}`),
  recountPages: () => api.post('/admin/files/recount-pages', {}),
  downloadUrl: (id) => `/api/files/${id}/download`,

  clients: (params) => api.get('/admin/clients', { query: params }),
  createClient: (payload) => api.post('/admin/clients', payload),
  updateClient: (id, payload) => api.patch(`/admin/clients/${id}`, payload),
  deleteClient: (id) => api.delete(`/admin/clients/${id}`),

  messages: (params) => api.get('/admin/messages', { query: params }),
  deleteMessage: (id) => api.delete(`/admin/messages/${id}`),

  locations: (params) => api.get('/admin/locations', { query: params }),
  createLocation: (payload) => api.post('/admin/locations', payload),
  updateLocation: (id, payload) => api.patch(`/admin/locations/${id}`, payload),
  deleteLocation: (id) => api.delete(`/admin/locations/${id}`),

  institutions: (params) => api.get('/admin/institutions', { query: params }),
  createInstitution: (payload) => api.post('/admin/institutions', payload),
  updateInstitution: (id, payload) => api.patch(`/admin/institutions/${id}`, payload),
  deleteInstitution: (id) => api.delete(`/admin/institutions/${id}`),

  careers: (params) => api.get('/admin/careers', { query: params }),
  createCareer: (payload) => api.post('/admin/careers', payload),
  updateCareer: (id, payload) => api.patch(`/admin/careers/${id}`, payload),
  deleteCareer: (id) => api.delete(`/admin/careers/${id}`),

  years: (params) => api.get('/admin/years', { query: params }),
  createYear: (payload) => api.post('/admin/years', payload),
  updateYear: (id, payload) => api.patch(`/admin/years/${id}`, payload),
  deleteYear: (id) => api.delete(`/admin/years/${id}`),

  subjects: (params) => api.get('/admin/subjects', { query: params }),
  createSubject: (payload) => api.post('/admin/subjects', payload),
  updateSubject: (id, payload) => api.patch(`/admin/subjects/${id}`, payload),
  deleteSubject: (id) => api.delete(`/admin/subjects/${id}`),

  pickupPoints: (params) => api.get('/admin/pickup-points', { query: params }),
  createPickupPoint: (payload) => api.post('/admin/pickup-points', payload),
  updatePickupPoint: (id, payload) => api.patch(`/admin/pickup-points/${id}`, payload),
  deletePickupPoint: (id) => api.delete(`/admin/pickup-points/${id}`),

  discountTiers: (params) => api.get('/admin/discount-tiers', { query: params }),
  createDiscountTier: (payload) => api.post('/admin/discount-tiers', payload),
  updateDiscountTier: (id, payload) => api.patch(`/admin/discount-tiers/${id}`, payload),
  deleteDiscountTier: (id) => api.delete(`/admin/discount-tiers/${id}`),
};
