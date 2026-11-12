import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// Request interceptor: attach Bearer token from localStorage for serverless compatibility
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('topperbatch_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Never redirect if this is the background session check
      if (err.config?.url?.includes('/auth/me')) {
        return Promise.reject(err);
      }

      // Don't redirect if already on public pages (landing, login, register, etc.)
      const publicPaths = ['/', '/login', '/register', '/forgot-password', '/reset-password'];
      const currentPath = window.location.pathname;
      const isPublic = publicPaths.some((p) => (p === '/' ? currentPath === '/' : currentPath.startsWith(p)));

      if (!isPublic) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export const auth = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword: (data) => api.post('/auth/reset-password', data),
};

export const admin = {
  getStats: () => api.get('/admin/stats'),
  getRegistrations: (params) => api.get('/admin/registrations', { params }),
  approveRegistration: (id) => api.put(`/admin/registrations/${id}/approve`),
  rejectRegistration: (id) => api.put(`/admin/registrations/${id}/reject`),
  getStudents: (params) => api.get('/admin/students', { params }),
  getStudent: (id) => api.get(`/admin/students/${id}`),
  updateStudentStatus: (id, data) => api.put(`/admin/students/${id}/status`, data),
  getAuditLogs: (params) => api.get('/admin/audit-logs', { params }),
  createAnnouncement: (data) => api.post('/admin/announcements', data),
  getAnnouncements: (params) => api.get('/admin/announcements', { params }),
  updateAnnouncement: (id, data) => api.put(`/admin/announcements/${id}`, data),
  deleteAnnouncement: (id) => api.delete(`/admin/announcements/${id}`),
  unlockControlRoom: (password) => api.post('/admin/control-room/unlock', { password }),
  getSettings: () =>
    api.get('/admin/settings', {
      headers: {
        'x-control-room-token': sessionStorage.getItem('topperbatch_control_room_token') || '',
      },
    }),
  updateSettings: (data) =>
    api.put('/admin/settings', data, {
      headers: {
        'x-control-room-token': sessionStorage.getItem('topperbatch_control_room_token') || '',
      },
    }),
  sendEmailBroadcast: (data) => api.post('/admin/email-broadcast', data),
  sendTestEmail: () =>
    api.post(
      '/admin/email-test',
      {},
      {
        headers: {
          'x-control-room-token': sessionStorage.getItem('topperbatch_control_room_token') || '',
        },
      }
    ),
  getActiveSessions: (params) => api.get('/admin/sessions', { params }),
  revokeSession: (id) => api.delete(`/admin/sessions/${id}`),
  revokeUserSessions: (userId) => api.delete(`/admin/sessions/user/${userId}`),
};

export const documents = {
  list: (params) => api.get('/documents', { params }),
  get: (id) => api.get(`/documents/${id}`),
  upload: (formData) =>
    api.post('/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  update: (id, data) => api.put(`/documents/${id}`, data),
  delete: (id) => api.delete(`/documents/${id}`),
  save: (id) => api.post(`/documents/${id}/save`),
  unsave: (id) => api.delete(`/documents/${id}/save`),
  getSaved: () => api.get('/documents/saved'),
  getSubjects: () => api.get('/documents/subjects'),
  getSemesters: () => api.get('/documents/semesters'),
  createSubject: (data) => api.post('/documents/subjects', data),
  createUnit: (subjectId, data) => api.post(`/documents/subjects/${subjectId}/units`, data),
  viewPdf: (id) => `/api/documents/${id}/view`,
};

export const chatbot = {
  getConversations: () => api.get('/chatbot/conversations'),
  getConversation: (id) => api.get(`/chatbot/conversations/${id}`),
  createConversation: (data) => api.post('/chatbot/conversations', data),
  sendMessage: (conversationId, data) =>
    api.post(`/chatbot/conversations/${conversationId}/messages`, data),
  deleteConversation: (id) => api.delete(`/chatbot/conversations/${id}`),
};

export const mcqGenerator = {
  generate: (formData) =>
    api.post('/admin/mcq-generator/generate', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  regenerateQuestion: (data) => api.post('/admin/mcq-generator/regenerate-question', data),
  getDrafts: () => api.get('/admin/mcq-generator/drafts'),
  getDraft: (id) => api.get(`/admin/mcq-generator/drafts/${id}`),
  updateDraft: (id, data) => api.put(`/admin/mcq-generator/drafts/${id}`, data),
  deleteDraft: (id) => api.delete(`/admin/mcq-generator/drafts/${id}`),
  publish: (data) => api.post('/admin/mcq-generator/publish', data),
};

export const quiz = {
  getDaily: () => api.get('/quiz/daily'),
  getDailyHistory: () => api.get('/quiz/daily/history'),
  startAttempt: (challengeId) => api.post(`/quiz/${challengeId}/start`),
  submitAttempt: (challengeId, data) => api.post(`/quiz/${challengeId}/submit`, data),
  getResults: (challengeId) => api.get(`/quiz/${challengeId}/results`),
  getLeaderboard: (params) => api.get('/quiz/leaderboard', { params }),
  getMyAttempts: () => api.get('/quiz/my-attempts'),
  getPractice: (params) => api.get('/quiz/practice', { params }),
};

export const community = {
  getChannels: () => api.get('/community/channels'),
  createChannel: (data) => api.post('/community/channels', data),
  updateChannel: (id, data) => api.put(`/community/channels/${id}`, data),
  deleteChannel: (id) => api.delete(`/community/channels/${id}`),
  getMessages: (channelId, params) =>
    api.get(`/community/channels/${channelId}/messages`, { params }),
  sendMessage: (channelId, data) =>
    api.post(`/community/channels/${channelId}/messages`, data),
  uploadFile: (channelId, formData) =>
    api.post(`/community/channels/${channelId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  editMessage: (channelId, msgId, data) =>
    api.put(`/community/channels/${channelId}/messages/${msgId}`, data),
  deleteMessage: (channelId, msgId) =>
    api.delete(`/community/channels/${channelId}/messages/${msgId}`),
  toggleReaction: (channelId, msgId, data) =>
    api.post(`/community/channels/${channelId}/messages/${msgId}/reactions`, data),
  pinMessage: (channelId, msgId) =>
    api.post(`/community/channels/${channelId}/messages/${msgId}/pin`),
  reportMessage: (channelId, msgId, data) =>
    api.post(`/community/channels/${channelId}/messages/${msgId}/report`, data),
  getReports: (params) => api.get('/community/reports', { params }),
  resolveReport: (id, data) => api.put(`/community/reports/${id}`, data),
};

export const profile = {
  getProfile: () => api.get('/profile'),
  updateProfile: (data) => api.put('/profile', data),
  getOtherProfile: (id) => api.get(`/profile/${id}`),
  uploadAvatar: (formData) =>
    api.post('/profile/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  reportScreenshotAttempt: (data) => api.post('/profile/screenshot-attempt', data),
};

export const notifications = {
  getAll: (params) => api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};

export const search = {
  globalSearch: (params) => api.get('/search', { params }),
};

export default api;
