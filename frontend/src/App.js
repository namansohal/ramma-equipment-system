import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Stock from './pages/Stock';
import Users from './pages/Users';
import Account from './pages/Account';
import Machines from './pages/Machines';
import MachineDetail from './pages/MachineDetail';
import Downtime from './pages/Downtime';
import Mainbook from './pages/Mainbook';
import Reports from './pages/Reports';
import Audit from './pages/Audit';
import Loans from './pages/Loans';
import Staff from './pages/Staff';
import Alerts from './pages/Alerts';
import MachineProfit from './pages/MachineProfit';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Momo from './pages/Momo';
import Runtime from './pages/Runtime';
import API from './services/api';
import Secret from './pages/Secret';

function isTokenExpired(token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (!payload.exp) return false;
        return payload.exp < Math.floor(Date.now() / 1000);
    } catch (e) {
        return true;
    }
}

function PrivateRoute({ children }) {
    const token = localStorage.getItem('token');
    if (!token || isTokenExpired(token)) {
        localStorage.clear();
        return <Navigate to="/login" />;
    }
    return children;
}

export default function App() {
    useEffect(() => {
        const interceptorId = API.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response && error.response.status === 401) {
                    localStorage.clear();
                    if (window.location.pathname !== '/login') {
                        window.location.href = '/login';
                    }
                }
                return Promise.reject(error);
            }
        );
        return () => { API.interceptors.response.eject(interceptorId); };
    }, []);

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                <Route path="/mainbook" element={<PrivateRoute><Mainbook /></PrivateRoute>} />
                <Route path="/expenses" element={<PrivateRoute><Expenses /></PrivateRoute>} />
                <Route path="/stock" element={<PrivateRoute><Stock /></PrivateRoute>} />
                <Route path="/loans" element={<PrivateRoute><Loans /></PrivateRoute>} />
                <Route path="/machines" element={<PrivateRoute><Machines /></PrivateRoute>} />
                <Route path="/machines/:id" element={<PrivateRoute><MachineDetail /></PrivateRoute>} />
                <Route path="/downtime" element={<PrivateRoute><Downtime /></PrivateRoute>} />
                <Route path="/reports" element={<PrivateRoute><Reports /></PrivateRoute>} />
                <Route path="/audit" element={<PrivateRoute><Audit /></PrivateRoute>} />
                <Route path="/staff" element={<PrivateRoute><Staff /></PrivateRoute>} />
                <Route path="/alerts" element={<PrivateRoute><Alerts /></PrivateRoute>} />
                <Route path="/machine-profit" element={<PrivateRoute><MachineProfit /></PrivateRoute>} />
                <Route path="/customers" element={<PrivateRoute><Customers /></PrivateRoute>} />
                <Route path="/customers/:key" element={<PrivateRoute><CustomerDetail /></PrivateRoute>} />
                <Route path="/momo" element={<PrivateRoute><Momo /></PrivateRoute>} />
                <Route path="/runtime" element={<PrivateRoute><Runtime /></PrivateRoute>} />
                <Route path="/secret" element={<PrivateRoute><Secret /></PrivateRoute>} />
                <Route path="/users" element={<PrivateRoute><Users /></PrivateRoute>} />
                <Route path="/account" element={<PrivateRoute><Account /></PrivateRoute>} />
                <Route path="*" element={<Navigate to="/login" />} />
            </Routes>
        </BrowserRouter>
    );
}