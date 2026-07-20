import axios from 'axios';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  register: (username, password, email) =>
    api.post('/auth/register', { username, password, email }),
  login: (username, password) =>
    api.post('/auth/login', { username, password })
};

export const customersAPI = {
  list: (limit = 10, offset = 0) =>
    api.get('/customers', { params: { limit, offset } }),
  search: (query, filter) =>
    api.get('/customers/search', { params: { query, filter } }),
  get: (id) =>
    api.get(`/customers/${id}`),
  getAccounts: (id) =>
    api.get(`/customers/${id}/accounts`),
  getTransactions: (id) =>
    api.get(`/customers/${id}/transactions`),
  create: (data) =>
    api.post('/customers', data),
  update: (id, data) =>
    api.put(`/customers/${id}`, data),
  delete: (id) =>
    api.delete(`/customers/${id}`),
  createAccount: (id, data) =>
    api.post(`/customers/${id}/accounts`, data)
};

export const accountsAPI = {
  delete: (id) =>
    api.delete(`/accounts/${id}`),
  transfer: (data) =>
    api.post('/accounts/transfer', data)
};

export default api;
