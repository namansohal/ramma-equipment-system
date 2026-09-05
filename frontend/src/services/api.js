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

// Auth
export const login = (username, password) => {
    const form = new URLSearchParams();
    form.append('username', username);
    form.append('password', password);
    return API.post('/auth/login', form);
};

// Expenses
export const getExpenses = (params) => API.get('/expenses/', { params });
export const createExpense = (data) => API.post('/expenses/', data);
export const getExpenseTypes = () => API.get('/expenses/types');

// Stock
export const getParts = () => API.get('/stock/parts');
export const getCurrentStock = () => API.get('/stock/current');
export const createStockTxn = (data) => API.post('/stock/', data);

// Machines
export const getMachines = () => API.get('/machines/');

// Users
export const getUsers = () => API.get('/users/');
export const createUser = (data) => API.post('/users/', data);
export const getRoles = () => API.get('/users/roles');
export const changePassword = (data) => API.post('/users/change-password', data);