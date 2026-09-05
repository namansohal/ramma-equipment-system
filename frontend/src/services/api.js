import axios from 'axios';

const API = axios.create({
    baseURL: 'http://localhost:8000',
});

API.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export const login = (username, password) => {
    const form = new URLSearchParams();
    form.append('username', username);
    form.append('password', password);
    return API.post('/auth/login', form);
};

export const getExpenses = (params) => API.get('/expenses/', { params });
export const createExpense = (data) => API.post('/expenses/', data);
export const deleteExpense = (id) => API.delete(`/expenses/${id}`);
export const getExpenseTypes = () => API.get('/expenses/types');

export const getParts = () => API.get('/stock/parts');
export const getCurrentStock = () => API.get('/stock/current');
export const getStockHistory = () => API.get('/stock/history');
export const createStockTxn = (data) => API.post('/stock/', data);
export const deleteStockTxn = (id) => API.delete(`/stock/${id}`);

export const getMachines = () => API.get('/machines/');

export const getUsers = () => API.get('/users/');
export const createUser = (data) => API.post('/users/', data);
export const deactivateUser = (userId) => API.delete(`/users/${userId}`);
export const getRoles = () => API.get('/users/roles');
export const changePassword = (data) => API.post('/users/change-password', data);
export const changeUsername = (data) => API.post('/users/change-username', data);
export const changeName = (userId, data) => API.post(`/users/${userId}/change-name`, data);
export const changeCode = (userId, data) => API.post(`/users/${userId}/change-code`, data);
export const changeRole = (userId, data) => API.post(`/users/${userId}/change-role`, data);

export const getDowntime = (params) => API.get('/downtime/', { params });
export const createDowntime = (data) => API.post('/downtime/', data);
export const endDowntime = (id, data) => API.patch(`/downtime/${id}/end`, data);

export const currentUser = () => JSON.parse(localStorage.getItem('user') || '{}');
export const isViewer = () => currentUser().role === 'viewer';
export const isAdmin = () => ['owner', 'manager'].includes(currentUser().role);
export const canEdit = () => currentUser().role !== 'viewer';

export default API;